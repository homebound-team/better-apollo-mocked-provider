import { ApolloCache, ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { LocalState } from "@apollo/client/local-state";
import { ApolloProvider } from "@apollo/client/react";
import React from "react";
import { MockedResponse } from "./MockedResponse";
import { MockLink } from "./mockLink";

// Homebound note: This is ~100% unchanged from apollo.
export interface MockedProviderProps {
  mocks?: readonly MockedResponse[];
  defaultOptions?: ApolloClient.DefaultOptions;
  cache?: ApolloCache;
  resolvers?: LocalState.Resolvers;
  childProps?: object;
  children?: React.ReactElement;
  link?: ApolloLink;
  showWarnings?: boolean;
}

export interface MockedProviderState {
  client: ApolloClient;
}

export class MockedProvider extends React.Component<MockedProviderProps, MockedProviderState> {
  constructor(props: MockedProviderProps) {
    super(props);

    const { mocks, defaultOptions, cache, resolvers, link } = this.props;
    const client = new ApolloClient({
      // Apollo Client 4 always normalizes queries with `__typename` (via the client's default
      // document transform), and `MockLink` keys its mocks the same way to match.
      cache: cache || new InMemoryCache(),
      defaultOptions,
      link: link || new MockLink(mocks || []),
      // Apollo Client 4 replaced the `resolvers` option with a `LocalState` instance.
      localState: resolvers ? new LocalState({ resolvers }) : undefined,
    });

    this.state = { client };
  }

  public render() {
    const { children, childProps } = this.props;
    return children ? (
      <ApolloProvider client={this.state.client}>
        {React.cloneElement(React.Children.only(children), { ...childProps })}
      </ApolloProvider>
    ) : null;
  }

  public componentWillUnmount() {
    // Since this.state.client was created in the constructor, it's this
    // MockedProvider's responsibility to terminate it.
    this.state.client.stop();
  }
}
