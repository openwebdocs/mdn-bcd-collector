//
// mdn-bcd-collector: unittest/unit/storage.test.ts
// Unittest for the temporary storage handler
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import {assert} from "chai";

import {CloudStorage, MemoryStorage, getStorage} from "./storage.js";

const SESSION_ID = "testsessionid";

/**
 * The bucket associated with the file.
 */
class FakeFile {
  _bucket: FakeBucket;
  _name: string;
  _data: any;

  /**
   * Constructs a new instance of the Storage class.
   * @param {string} bucket - The bucket name.
   * @param {string} name - The name of the storage.
   */
  constructor(bucket, name) {
    this._bucket = bucket;
    this._name = name;
    this._data = null;
  }

  /**
   * Gets the name of the storage.
   * @returns {string} The name of the storage.
   */
  get name() {
    return this._name;
  }

  /**
   * Saves the provided data to the storage.
   * @param {any} data - The data to be saved.
   * @returns {Promise<void>} - A promise that resolves when the data is saved.
   */
  async save(data) {
    this._data = data;
    this._bucket._files.set(this._name, this);
  }

  /**
   * Downloads the data.
   * @returns {Promise<any[]>} The downloaded data.
   */
  async download() {
    return [this._data];
  }
}

/**
 * Represents a fake bucket for testing purposes.
 */
class FakeBucket {
  _files: Map<string, any>;

  /**
   * Constructs a new instance of the FakeBucket class.
   */
  constructor() {
    this._files = new Map();
  }

  /**
   * Retrieves a file from the storage by its name.
   * If the file already exists in the storage, it returns the existing file.
   * Otherwise, it creates a new file and returns it.
   * @param {string} name - The name of the file to retrieve.
   * @returns {FakeFile} The file object.
   */
  file(name: string) {
    const existing = this._files.get(name);
    if (existing) {
      return existing;
    }
    return new FakeFile(this, name);
  }

  /**
   * Retrieves files from the storage based on the specified options.
   * @param {any} options - The options for retrieving files.
   * @returns {Promise<any[]>} An array of files that match the specified options.
   */
  async getFiles(options: any) {
    const files: any[] = [];
    for (const [name, file] of this._files) {
      if (name.startsWith(options.prefix)) {
        files.push(file);
      }
    }
    return [files];
  }
}

describe("storage", () => {
  for (const StorageClass of [CloudStorage, MemoryStorage]) {
    describe(StorageClass.name, () => {
      let storage: any = null;

      beforeEach(() => {
        if (StorageClass === CloudStorage) {
          storage = new CloudStorage("fake-project", "fake-bucket", "");
          storage._bucket = new FakeBucket();
        } else {
          storage = new MemoryStorage();
        }
      });

      afterEach(() => {
        storage = null;
      });

      it("put", async () => {
        await storage.put(SESSION_ID, "/a/test.html", {x: 1});

        const data = await storage.getAll(SESSION_ID);
        assert.deepStrictEqual(data, {"/a/test.html": {x: 1}});
      });

      it("put twice", async () => {
        await storage.put(SESSION_ID, "/a/test.html", {x: 1});
        await storage.put(SESSION_ID, "/b/test.html", {x: 2});

        const data = await storage.getAll(SESSION_ID);
        assert.deepStrictEqual(data, {
          "/a/test.html": {x: 1},
          "/b/test.html": {x: 2},
        });
      });

      it("put same pathname twice", async () => {
        await storage.put(SESSION_ID, "/a/test.html", {x: 1});
        await storage.put(SESSION_ID, "/a/test.html", {x: 2});

        // the data from the second put is used
        const data = await storage.getAll(SESSION_ID);
        assert.deepStrictEqual(data, {"/a/test.html": {x: 2}});
      });

      it("put with URL as key", async () => {
        const url = "https://host.test/a/test.html?foo#bar";
        const value = {x: 3};
        await storage.put(SESSION_ID, url, value);

        const data = await storage.getAll(SESSION_ID);
        const expected = {};
        expected[url] = value;
        assert.deepStrictEqual(data, expected);
      });

      it("getAll without put", async () => {
        const data = await storage.getAll(SESSION_ID);
        assert.deepStrictEqual(data, {});
      });

      it("saveFile + readFile", async () => {
        const filename = "test.json";
        const bytes = Buffer.from("{}");
        await storage.saveFile(filename, bytes);
        const readBytes = await storage.readFile(filename);
        assert.instanceOf(readBytes, Buffer);
        assert.equal(readBytes.toString(), "{}");
      });
    });
  }

  describe("getStorage", () => {
    it("testing", () => {
      const storage = getStorage("test-version");
      assert(storage instanceof MemoryStorage);
    });

    it("production: GAE", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GCLOUD_STORAGE_BUCKET = "test-bucket";

      const storage = getStorage("test-version");
      assert(storage instanceof CloudStorage);
      assert.equal((storage as CloudStorage)._bucket.name, "test-bucket");
      assert.equal((storage as CloudStorage)._version, "test-version");

      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GCLOUD_STORAGE_BUCKET;
    });

    it("production: Heroku + GAE", () => {
      process.env.HDRIVE_GOOGLE_JSON_KEY = '{"project_id": "test-project"}';
      process.env.HDRIVE_GOOGLE_BUCKET = "test-bucket";

      const storage = getStorage("test-version");
      assert(storage instanceof CloudStorage);
      assert.equal((storage as CloudStorage)._bucket.name, "test-bucket");
      assert.equal((storage as CloudStorage)._version, "test-version");

      delete process.env.HDRIVE_GOOGLE_JSON_KEY;
      delete process.env.HDRIVE_GOOGLE_BUCKET;
    });
  });
});
