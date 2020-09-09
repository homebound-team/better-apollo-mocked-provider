import { FetchResult, GraphQLRequest } from "@apollo/client";

export type ResultFunction<T> = () => T;

export interface MockedResponse<TData = Record<string, any>> {
  request: GraphQLRequest;
  result?: FetchResult<TData> | ResultFunction<FetchResult<TData>>;
  error?: Error;
  delay?: number;
  // Homebound note: Added as part of making MockLink behavior more sane/less opaque.
  loading?: boolean;
  newData?: ResultFunction<FetchResult>;
  requested?: number;
}
