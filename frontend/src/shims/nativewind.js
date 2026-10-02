/**
 * nativewind compatibility shim for UniWind
 * 
 * This module provides the NativeWind v5 API surface using React Native 
 * built-ins and UniWind, so that gluestack-ui generated components work
 * without having nativewind installed.
 */

const ReactNative = require('react-native');

// useColorScheme - delegate to react-native
function useColorScheme() {
  const scheme = ReactNative.useColorScheme();
  return { colorScheme: scheme || 'light' };
}

// cssInterop - no-op shim (just returns the component unchanged)
function cssInterop(component, _mapping) {
  return component;
}

// remapProps - no-op shim (just returns the component unchanged)
function remapProps(component, _mapping) {
  return component;
}

// vars() - no-op for UniWind; CSS vars are handled via global.css
function vars(variables) {
  // Return the variables object as-is; UniWind handles this via CSS
  return variables;
}

// useGlobalStyles - no-op hook
function useGlobalStyles() {
  return {};
}

// StyleSheet extension - passthrough to RN
const StyleSheet = ReactNative.StyleSheet;

module.exports = {
  useColorScheme,
  cssInterop,
  remapProps,
  vars,
  useGlobalStyles,
  StyleSheet,
};
