declare namespace jest {
  // Only used by the MockedProvider.test.tsx
  interface It {
    async(name: string, callback: (resolve: (result?: any) => void, reject: (reason?: any) => void) => any);
  }
}
