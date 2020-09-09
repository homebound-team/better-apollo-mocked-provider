import { ApolloLink, FetchResult, GraphQLRequest, Operation } from "@apollo/client";
import {
  addTypenameToDocument,
  Observable,
  removeClientSetsFromDocument,
  removeConnectionDirectiveFromDocument,
} from "@apollo/client/utilities";
import stringify from "fast-json-stable-stringify";
import { print } from "graphql/language/printer";
import { invariant } from "ts-invariant";
import { MockedResponse, ResultFunction } from "./MockedResponse";

/**
 * A fork of apollo-client's `MockLink` to be more developer friendly.
 *
 * The biggest change is being more chatty on failures so that developers
 * can more easily see "ah that is why this didn't match".
 */
export class MockLink extends ApolloLink {
  public operation: Operation | undefined;
  public addTypename: Boolean = true;
  private mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};
  private madeResponsesByKey: { [key: string]: MockedResponse[] } = {};

  constructor(mockedResponses: ReadonlyArray<MockedResponse>, addTypename: Boolean = true) {
    super();
    this.addTypename = addTypename;
    mockedResponses.forEach((res) => this.addMockedResponse(res));
  }

  public addMockedResponse(mockedResponse: MockedResponse) {
    const normalizedMockedResponse = normalizeMockedResponse(mockedResponse);
    const key = requestToKey(normalizedMockedResponse.request, this.addTypename);
    let mockedResponses = this.mockedResponsesByKey[key];
    if (!mockedResponses) {
      mockedResponses = [];
      this.mockedResponsesByKey[key] = mockedResponses;
    }
    mockedResponses.push(normalizedMockedResponse);
  }

  public request(operation: Operation): Observable<FetchResult> {
    this.operation = operation;

    const key = requestToKey(operation, this.addTypename);

    // Homebound note: note that we use stringify to:
    //
    // a) strip undefined keys, and
    // b) call `.toJSON` on any not-actually-JSON values in the variables, i.e. user-defined types
    //
    // This is really just a bug fix that should be up-streamed, see:
    //
    // See https://github.com/apollographql/apollo-client/issues/6771
    const requestVariables = stringify(operation.variables || {});

    // Homebound note: little bit of refactoring here for simplification.
    const possibleRequests = this.mockedResponsesByKey[key] || [];
    const responseIndex = possibleRequests.findIndex((res) => {
      return requestVariables === stringify(res.request.variables || {});
    });

    if (responseIndex === -1) {
      const madeAny = !!this.madeResponsesByKey[key];
      const errorPrefix = madeAny ? "No more" : "No";
      const potentialVariables = possibleRequests.map((mr) => stringify(mr.request.variables || {}));
      const madeVariables = (this.madeResponsesByKey[key] || []).map((mr) => stringify(mr.request.variables || {}));

      // The apollo-client impl returns `null` from here. This "seems fine" but the super tricky
      // thing is that `this.onError` turns into `throw error` which is purposefully suppressed if
      // `first = true`, per the "blindly catching".
      //
      // https://github.com/apollographql/apollo-client/blob/master/src/core/ObservableQuery.ts#L553
      //
      // I believe that ObservableQuery comment is fine, however it seems this is how MockLink was
      // achieving the "leave un-mocked requests as loading". Because we don't return loading, we
      // throw and usually this is suppressed.
      //
      // _Unless_ this was not the 1st request, in which case the hard-coded "No more mocked responses"
      // error text actually makes sense.
      //
      // This all seems too tricky, so we're making a breaking change where instead of `return null`,
      // we're going to return the observableResult with error set.
      //
      // This means that clients must explicitly opt-in to the `stay loading behavior`, i.e. via
      // the MockedResponse.locking that we've added.
      const lines = [
        `${errorPrefix} mocked responses for the query: ${operation.operationName}`,
        `Actual variables:`,
        requestVariables,
        ``,
        `Mocked variables:`,
        ...potentialVariables,
        // If there were previous requests, let the developer know that we know about them, i.e. their setup is correct
        ...(madeVariables.length === 0 ? [] : ["Already made requests", ...madeVariables]),
      ];
      const message = lines.join("\n");
      // Highlight this as a usage error
      console.error(message);
      return observableResult(undefined, new Error(message), false, undefined);
    }

    const response = possibleRequests[responseIndex];

    if (response.requested === undefined) {
      response.requested = 0;
    }
    response.requested++;

    // Homebound note: This is a breaking change: we only remove the request
    // from possibleRequests if the user has either:
    //
    // a) explicitly provided multiple requests for this key, or
    // b) set a `newData` on 1st mocked response
    //
    // This is primarily for developer ergonomics, i.e. most other mocking libraries
    // will keep re-using the same request.
    const { newData } = response;
    if (possibleRequests.length > 1 || newData) {
      possibleRequests.splice(responseIndex, 1);
      if (newData) {
        response.result = newData();
        possibleRequests.push(response);
      }
      // Record that this request was made instead of throwing it away.
      let made = this.madeResponsesByKey[key];
      if (!made) {
        made = [];
        this.madeResponsesByKey[key] = made;
      }
      made.push(response);
    }

    const { result, error, loading, delay } = response;
    if (!result && !error && loading === undefined) {
      const message = `Mocked response should contain either result, error, or loading: ${key}`;
      // Highlight this as a usage error
      console.error(message);
      return observableResult(result, new Error(message), false, delay);
    }

    return observableResult(result, error, loading, delay);
  }
}

function observableResult(
  result: FetchResult | ResultFunction<FetchResult> | undefined,
  error: Error | undefined,
  loading: boolean | undefined,
  delay: number | undefined,
) {
  return new Observable<FetchResult>((observer) => {
    const resolve = () => {
      if (error) {
        observer.error(error);
      } else if (result) {
        observer.next(typeof result === "function" ? (result as ResultFunction<FetchResult>)() : result);
        observer.complete();
      } else if (loading) {
        // leave it loading
      }
    };
    const timer = setTimeout(resolve, delay ?? 0);
    return () => clearTimeout(timer);
  });
}

// Homebound note: Removed the cloneDeep so that the caller can observe our .requested assignment.
function normalizeMockedResponse(mockedResponse: MockedResponse): MockedResponse {
  const queryWithoutConnection = removeConnectionDirectiveFromDocument(mockedResponse.request.query);
  invariant(queryWithoutConnection, "query is required");
  mockedResponse.request.query = queryWithoutConnection!;
  const query = removeClientSetsFromDocument(mockedResponse.request.query);
  if (query) {
    mockedResponse.request.query = query;
  }
  return mockedResponse;
}

export interface MockApolloLink extends ApolloLink {
  operation?: Operation;
}

// Pass in multiple mocked responses, so that you can test flows that end up
// making multiple queries to the server.
// NOTE: The last arg can optionally be an `addTypename` arg.
export function mockSingleLink(...mockedResponses: Array<any>): MockApolloLink {
  // To pull off the potential typename. If this isn't a boolean, we'll just
  // set it true later.
  let maybeTypename = mockedResponses[mockedResponses.length - 1];
  let mocks = mockedResponses.slice(0, mockedResponses.length - 1);

  if (typeof maybeTypename !== "boolean") {
    mocks = mockedResponses;
    maybeTypename = true;
  }

  return new MockLink(mocks, maybeTypename);
}

function requestToKey(request: GraphQLRequest, addTypename: Boolean): string {
  const queryString = request.query && print(addTypename ? addTypenameToDocument(request.query) : request.query);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}
