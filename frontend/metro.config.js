const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add resolver aliases for modules that use subpath imports without an exports map
const projectRoot = __dirname;

config.resolver = {
  ...config.resolver,
  alias: {
    // Map nativewind to our compatibility shim
    nativewind: path.resolve(projectRoot, 'src/shims/nativewind.js'),
  },
  // Resolve @gluestack-ui/core and @gluestack-ui/utils subpaths
  resolveRequest: (context, moduleName, platform) => {
    // Handle @gluestack-ui/core subpath imports
    if (moduleName.startsWith('@gluestack-ui/core/')) {
      const subpath = moduleName.replace('@gluestack-ui/core/', '');
      return {
        type: 'sourceFile',
        filePath: path.resolve(
          projectRoot,
          'node_modules/@gluestack-ui/core',
          subpath + '.ts'
        ),
      };
    }

    // Handle @gluestack-ui/utils subpath imports
    if (moduleName.startsWith('@gluestack-ui/utils/')) {
      const subpath = moduleName.replace('@gluestack-ui/utils/', '');
      const libPath = path.resolve(
        projectRoot,
        'node_modules/@gluestack-ui/utils/lib/esm',
        subpath,
        'index.js'
      );
      return {
        type: 'sourceFile',
        filePath: libPath,
      };
    }

    // Default resolution
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['dark'],
});
