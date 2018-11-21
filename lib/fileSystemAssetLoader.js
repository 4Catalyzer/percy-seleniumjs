// This is a clone of
// https://github.com/percy/percy-webdriverio/blob/master/src/fileSystemAssetLoader.js

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const walk = require('walk');

const MAX_FILE_SIZE_BYTES = 15728640;
const DEFAULT_SKIPPED_ASSETS = [];

class FileSystemAssetLoader {
  constructor(options) {
    this.options = options;
    this.options.skippedAssets =
      this.options.skippedAssets || DEFAULT_SKIPPED_ASSETS;
  }
  findBuildResources(percyClient) {
    return new Promise((resolve, reject) => {
      const { options } = this;
      const { buildDir } = options;

      let mountPath = `${options.mountPath || ''}`;
      // Only add a / to the mountPath if it doesn't already end in one.
      if (mountPath.slice(-1) !== '/') {
        mountPath += '/';
      }

      let isDirectory = false;
      try {
        isDirectory = fs.statSync(buildDir).isDirectory();
      } catch (err) {
        reject(err);
        return;
      }

      if (isDirectory) {
        const resources = [];
        let errors;
        walk.walkSync(buildDir, {
          followLinks: true,
          listeners: {
            file: function file(root, fileStats, next) {
              const absolutePath = path.join(root, fileStats.name);
              let resourceUrl = absolutePath;
              if (path.sep === '\\') {
                // Windows: transform filesystem backslashes into forward-slashes for the URL.
                resourceUrl = resourceUrl.replace(/\\/g, '/');
              }

              resourceUrl = resourceUrl.replace(buildDir, '');

              if (resourceUrl.charAt(0) === '/') {
                resourceUrl = resourceUrl.substr(1);
              }

              for (const assetPattern of options.skippedAssets) {
                if (resourceUrl.match(assetPattern)) {
                  next();
                  return;
                }
              }
              if (fs.statSync(absolutePath).size > MAX_FILE_SIZE_BYTES) {
                // eslint-disable-next-line no-console
                console.warn(
                  '\n[percy][WARNING] Skipping large file: ',
                  resourceUrl,
                );
                return;
              }
              const content = fs.readFileSync(absolutePath);
              resources.push(
                percyClient.makeResource({
                  resourceUrl: encodeURI(`${mountPath}${resourceUrl}`),
                  content,
                  mimetype: mime.lookup(resourceUrl),
                }),
              );
              next();
            },
            errors: function handleErrors(root, fileStats, next) {
              errors = fileStats;
              next();
            },
          },
        });
        if (resources.length === 0 && errors) {
          reject(errors);
        } else {
          resolve(resources);
        }
      } else {
        reject(new Error(`${buildDir} is not a directory`));
      }
    });
  }
}

module.exports = FileSystemAssetLoader;
