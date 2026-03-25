/**
 * Manual mock for react-native-toast-message
 * Package not yet installed (set up in Plan 04 wiring).
 */
const Toast = {
  show: jest.fn(),
  hide: jest.fn(),
};

module.exports = {
  __esModule: true,
  default: Toast,
};
