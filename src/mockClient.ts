import { ApolloClient, InMemoryCache, NormalizedCacheObject } from "@apollo/client";
import { DocumentNode } from "graphql";
import { mockSingleLink } from "./mockLink";

export function createMockClient<TData>(
  data: TData,
  query: DocumentNode,
  variables = {},
): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    link: mockSingleLink({
      request: { query, variables },
      result: { data },
    }).setOnError((error) => {
      throw error;
    }),
    cache: new InMemoryCache({ addTypename: false }),
  });
}
