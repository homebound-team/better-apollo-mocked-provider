import { InMemoryCache } from "@apollo/client";
import { QueryManager } from "@apollo/client/core/QueryManager";
import { MockedResponse } from "./MockedResponse";
import { mockSingleLink } from "./mockLink";

// Helper method for the tests that construct a query manager out of a
// a list of mocked responses for a mocked network interface.
export default (reject: (reason: any) => any, ...mockedResponses: MockedResponse[]) => {
  return new QueryManager({
    link: mockSingleLink(...mockedResponses).setOnError(reject),
    cache: new InMemoryCache({ addTypename: false }),
  });
};
