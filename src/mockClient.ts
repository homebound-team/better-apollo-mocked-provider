import { ApolloClient, InMemoryCache } from "@apollo/client";
import type { DocumentNode } from "graphql";
import { MockLink } from "./mockLink.js";

/** I.e. `createMockClient(data, query)` → an `ApolloClient` that resolves `query` with `data`. */
export function createMockClient<TData extends Record<string, any>>(
  data: TData,
  query: DocumentNode,
  variables = {},
): ApolloClient {
  return new ApolloClient({
    link: new MockLink([{ request: { query, variables }, result: { data } }]),
    cache: new InMemoryCache(),
  });
}
