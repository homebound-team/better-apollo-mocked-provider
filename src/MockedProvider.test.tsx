import { ApolloLink, InMemoryCache, useQuery } from "@apollo/client";
import { render, wait } from "@testing-library/react";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import React from "react";
import { MockedProvider } from "./MockedProvider";
import { MockedResponse } from "./MockedResponse";
import { MockLink } from "./mockLink";

const variables = {
  username: "mock_username",
};

const userWithoutTypeName = {
  id: "user_id",
};

const user = {
  __typename: "User",
  ...userWithoutTypeName,
};

const query: DocumentNode = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
    }
  }
`;

const queryWithTypename: DocumentNode = gql`
  query GetUser($username: String!) {
    user(username: $username) {
      id
      __typename
    }
  }
`;

const mocks: ReadonlyArray<MockedResponse> = [
  {
    request: {
      query,
      variables,
    },
    result: { data: { user } },
  },
];

interface Data {
  user: {
    id: string;
  };
}

interface Variables {
  username: string;
}

let errorThrown = false;
const errorLink = new ApolloLink((operation, forward) => {
  // Homebound note: We've changed this from the default MockedProvider.test.tsx
  // setup b/c we no longer throw errors from the MockLink impl (see longer note
  // in that file). Instead we always use the observableResult + a console.error
  // to let the programmer know what's going on.
  //
  // Normally I would not prefer this, but per note in MockLink link, the 1st error
  // thrown from links is suppressed "because they show up later" (...except that
  // they don't for MockLink's prior behavior).
  const observer = forward(operation);
  observer.subscribe(
    () => {},
    () => {
      errorThrown = true;
    },
  );
  return observer;
});

describe("MockedProvider", () => {
  beforeEach(() => {
    errorThrown = false;
  });

  it.async("should mock the data", async (resolve, reject) => {
    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(data!.user).toMatchSnapshot();
      }
      return null;
    }

    const mock: MockedResponse = {
      request: { query, variables },
      result: { data: { user } },
    };

    render(
      <MockedProvider mocks={[mock]}>
        <Component {...variables} />
      </MockedProvider>,
    );

    return wait(() => {
      expect(mock.requestedCount).toEqual(1);
    }).then(resolve, reject);
  });

  it.async("should allow querying with the typename", async (resolve, reject) => {
    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(data!.user).toMatchSnapshot();
      }
      return null;
    }

    const mocksWithTypename = [
      {
        request: {
          query: queryWithTypename,
          variables,
        },
        result: { data: { user } },
      },
    ];

    render(
      <MockedProvider mocks={mocksWithTypename}>
        <Component {...variables} />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });

  it.async("should allow using a custom cache", async (resolve, reject) => {
    const cache = new InMemoryCache();
    cache.writeQuery({
      query,
      variables,
      data: { user },
    });

    function Component({ username }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, { variables });
      if (!loading) {
        expect(data).toMatchObject({ user });
      }
      return null;
    }

    render(
      <MockedProvider mocks={[]} cache={cache}>
        <Component {...variables} />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });

  it.async("should error if the variables in the mock and component do not match", async (resolve, reject) => {
    function Component({ ...variables }: Variables) {
      useQuery<Data, Variables>(query, { variables });
      return null;
    }

    const variables2 = {
      username: "other_user",
    };

    const link = ApolloLink.from([errorLink, new MockLink(mocks)]);

    render(
      <MockedProvider link={link}>
        <Component {...variables2} />
      </MockedProvider>,
    );

    return wait(() => {
      expect(errorThrown).toBeTruthy();
    }).then(resolve, reject);
  });

  it.async("should error if the variables do not deep equal", async (resolve, reject) => {
    function Component({ ...variables }: Variables) {
      useQuery<Data, Variables>(query, { variables });
      return null;
    }

    const mocks2 = [
      {
        request: {
          query,
          variables: {
            age: 13,
            username: "some_user",
          },
        },
        result: { data: { user } },
      },
    ];

    const variables2 = {
      username: "some_user",
      age: 42,
    };

    const link = ApolloLink.from([errorLink, new MockLink(mocks2)]);

    render(
      <MockedProvider link={link}>
        <Component {...variables2} />
      </MockedProvider>,
    );

    return wait(() => {
      expect(errorThrown).toBeTruthy();
    }).then(resolve, reject);
  });

  it.async("should not error if the variables match but have different order", async (resolve, reject) => {
    function Component({ ...variables }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(data).toMatchSnapshot();
      }
      return null;
    }

    const mocks2 = [
      {
        request: {
          query,
          variables: {
            age: 13,
            username: "some_user",
          },
        },
        result: { data: { user } },
      },
    ];

    const variables2 = {
      username: "some_user",
      age: 13,
    };

    render(
      <MockedProvider mocks={mocks2}>
        <Component {...variables2} />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });

  it.async("should support mocking a network error", async (resolve, reject) => {
    function Component({ ...variables }: Variables) {
      const { loading, error } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(error).toEqual(new Error("something went wrong"));
      }
      return null;
    }

    const mocksError = [
      {
        request: {
          query,
          variables,
        },
        error: new Error("something went wrong"),
      },
    ];

    render(
      <MockedProvider mocks={mocksError}>
        <Component {...variables} />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });

  it.async("should error if the query in the mock and component do not match", async (resolve, reject) => {
    function Component({ ...variables }: Variables) {
      useQuery<Data, Variables>(query, { variables });
      return null;
    }

    const mocksDifferentQuery = [
      {
        request: {
          query: gql`
            query OtherQuery {
              otherQuery {
                id
              }
            }
          `,
          variables,
        },
        result: { data: { user } },
      },
    ];

    const link = ApolloLink.from([errorLink, new MockLink(mocksDifferentQuery)]);

    render(
      <MockedProvider link={link}>
        <Component {...variables} />
      </MockedProvider>,
    );

    return wait(() => {
      expect(errorThrown).toBeTruthy();
    }).then(resolve, reject);
  });

  it("should pass down props prop in mock as props for the component", () => {
    function Component({ ...variables }) {
      expect(variables.foo).toBe("bar");
      expect(variables.baz).toBe("qux");
      return null;
    }

    render(
      <MockedProvider mocks={mocks} childProps={{ foo: "bar", baz: "qux" }}>
        <Component {...variables} />
      </MockedProvider>,
    );
  });

  it("should not crash on unmount if there is no query manager", () => {
    function Component() {
      return null;
    }

    const { unmount } = render(
      <MockedProvider>
        <Component />
      </MockedProvider>,
    );

    unmount();
  });

  it.async("should support returning mocked results from a function", async (resolve, reject) => {
    let resultReturned = false;

    const testUser = {
      __typename: "User",
      id: 12345,
    };

    function Component({ ...variables }: Variables) {
      const { loading, data } = useQuery<Data, Variables>(query, {
        variables,
      });
      if (!loading) {
        expect(data!.user).toEqual(testUser);
        expect(resultReturned).toBe(true);
      }
      return null;
    }

    const testQuery: DocumentNode = gql`
      query GetUser($username: String!) {
        user(username: $username) {
          id
        }
      }
    `;

    const testVariables = {
      username: "jsmith",
    };
    const testMocks = [
      {
        request: {
          query: testQuery,
          variables: testVariables,
        },
        result() {
          resultReturned = true;
          return {
            data: {
              user: {
                __typename: "User",
                id: 12345,
              },
            },
          };
        },
      },
    ];

    render(
      <MockedProvider mocks={testMocks}>
        <Component {...testVariables} />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });
});

describe("@client testing", () => {
  it.async("should support @client fields with a custom cache", async (resolve, reject) => {
    const cache = new InMemoryCache();

    cache.writeQuery({
      query: gql`
        {
          networkStatus {
            isOnline
          }
        }
      `,
      data: {
        networkStatus: {
          __typename: "NetworkStatus",
          isOnline: true,
        },
      },
    });

    function Component() {
      const { loading, data } = useQuery(gql`
        {
          networkStatus @client {
            isOnline
          }
        }
      `);
      if (!loading) {
        expect(data!.networkStatus.__typename).toEqual("NetworkStatus");
        expect(data!.networkStatus.isOnline).toEqual(true);
      }
      return null;
    }

    render(
      <MockedProvider cache={cache}>
        <Component />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });

  it.async("should support @client fields with field policies", async (resolve, reject) => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            networkStatus() {
              return {
                __typename: "NetworkStatus",
                isOnline: true,
              };
            },
          },
        },
      },
    });

    function Component() {
      const { loading, data } = useQuery(gql`
        {
          networkStatus @client {
            isOnline
          }
        }
      `);
      if (!loading) {
        expect(data!.networkStatus.__typename).toEqual("NetworkStatus");
        expect(data!.networkStatus.isOnline).toEqual(true);
      }
      return null;
    }

    render(
      <MockedProvider cache={cache}>
        <Component />
      </MockedProvider>,
    );

    return wait().then(resolve, reject);
  });
});
