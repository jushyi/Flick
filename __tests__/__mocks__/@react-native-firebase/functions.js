/**
 * Mock for @react-native-firebase/functions
 */
const mockHttpsCallable = jest.fn(() => jest.fn(() => Promise.resolve({ data: {} })));

const functions = () => ({
  httpsCallable: mockHttpsCallable,
});

module.exports = functions;
module.exports.mockHttpsCallable = mockHttpsCallable;
