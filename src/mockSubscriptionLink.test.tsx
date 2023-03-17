import { ApolloClient, ApolloProvider, InMemoryCache, useSubscription } from "@apollo/client";
import { render, waitFor } from "@testing-library/react";
import gql from "graphql-tag";
import React from "react";
import { MockSubscriptionLink } from "./mockSubscriptionLink";

describe("mockSubscriptionLink", () => {
  it("should work with multiple subscribers to the same mock websocket", () => {
    const subscription = gql`
      subscription {
        car {
          make
        }
      }
    `;

    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false }),
    });

    let renderCountA = 0;
    const ComponentA = () => {
      useSubscription(subscription);
      renderCountA += 1;
      return null;
    };

    let renderCountB = 0;
    const ComponentB = () => {
      useSubscription(subscription);
      renderCountB += 1;
      return null;
    };

    const results = ["Audi", "BMW", "Mercedes", "Hyundai"].map((make) => ({
      result: { data: { car: { make } } },
    }));

    const Component = () => {
      const [index, setIndex] = React.useState(0);
      React.useEffect(() => {
        if (index >= results.length) return;
        link.simulateResult(results[index]);
        setIndex(index + 1);
      }, [index]);
      return null;
    };

    render(
      <ApolloProvider client={client}>
        <div>
          <Component />
          <ComponentA />
          <ComponentB />
        </div>
      </ApolloProvider>,
    );

    return waitFor(
      () => {
        // React 18
        expect(renderCountA).toBe(2);
      },
      { timeout: 1000 },
    );
  });
});
