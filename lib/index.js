const PercyClient = require('percy-client');

const FileSystemAssetLoader = require('./fileSystemAssetLoader');

const DEFAULT_DOCTYPE = '<!DOCTYPE html>';

class PercySeleniumClient {
  constructor({ driver, assetLoaderOpts, ...clientOptions }) {
    this.percyClient = new PercyClient({
      token: process.env.PERCY_TOKEN,
      apIUrl: process.env.PERCY_API,
      clientInfo: 'percy-seleniumjs',
      ...clientOptions,
    });

    this.assetLoader = new FileSystemAssetLoader(assetLoaderOpts);
    this.driver = driver;
  }

  parseMissingResources(response) {
    return (
      (response.body.data &&
        response.body.data.relationships &&
        response.body.data.relationships['missing-resources'] &&
        response.body.data.relationships['missing-resources'].data) ||
      []
    );
  }

  uploadMissingResources(response, shaToResource) {
    const missingResources = this.parseMissingResources(response);
    return Promise.all(
      missingResources.map(missingResource =>
        this.percyClient.uploadResource(
          this.buildId,
          shaToResource[missingResource.id].content,
        ),
      ),
    );
  }

  async createBuild() {
    const resources = await this.assetLoader.findBuildResources(
      this.percyClient,
    );

    const buildResponse = await this.percyClient.createBuild({ resources });

    this.buildId = buildResponse.body.data.id;

    const shaToResource = {};
    for (const resource of resources) {
      shaToResource[resource.sha] = resource;
    }
    await this.uploadMissingResources(buildResponse, shaToResource);
  }

  async createSnapshot(options) {
    const source = await this.domSnapshot();
    const rootResource = this.percyClient.makeResource({
      resourceUrl: '/',
      content: source,
      isRoot: true,
      mimetype: 'text/html',
    });
    const snapshotResponse = await this.percyClient.createSnapshot(
      this.buildId,
      [rootResource],
      options,
    );
    const snapshotId = snapshotResponse.body.data.id;
    const shaToResource = {};
    shaToResource[rootResource.sha] = rootResource;
    await this.uploadMissingResources(snapshotResponse, shaToResource);
    await this.percyClient.finalizeSnapshot(snapshotId);
  }

  async finalizeBuild() {
    await this.percyClient.finalizeBuild(this.buildId);
  }

  async domSnapshot() {
    const docType = await this.getDoctype();
    const dom = await this.driver.executeScript(
      // eslint-disable-next-line
      () => window.document.documentElement.outerHTML,
    );
    return docType + dom;
  }

  async getDoctype() {
    const doctype = await this.driver.executeScript(
      // eslint-disable-next-line
      () => window.document.doctype,
    );

    return doctype ? this.doctypeToString(doctype) : DEFAULT_DOCTYPE;
  }

  doctypeToString(doctype) {
    const publicDeclaration = doctype.publicId
      ? ` PUBLIC "${doctype.publicId}" `
      : '';
    const systemDeclaration = doctype.systemId
      ? ` SYSTEM "${doctype.systemId}" `
      : '';

    return `<!DOCTYPE ${
      doctype.name
    } ${publicDeclaration} ${systemDeclaration}>`;
  }
}

module.exports = PercySeleniumClient;
