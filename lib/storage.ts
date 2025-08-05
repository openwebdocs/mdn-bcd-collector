//
// mdn-bcd-collector: lib/storage.ts
// Module to handle temporary storage for the web app, locally or in GAE
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import assert from "node:assert/strict";

import fs from "fs-extra";
import {Storage as GAEStorage, Bucket} from "@google-cloud/storage";

import type {Extensions, ReportStore, TestResult} from "../types/types.d.ts";

/**
 * Represents a base storage class for storing and retrieving data.
 */
abstract class Storage {
  /**
   * Saves a value to the specified session and key.
   * @param sessionId - The session ID.
   * @param key - The key to store the value under.
   * @param value - The value to be stored.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async put(sessionId: string, key: string, value: any): Promise<void> {
    throw new Error("put method not implemented");
  }

  /**
   * Retrieves the value associated with the specified session and key.
   * @param sessionId - The session ID.
   * @param key - The key to retrieve the value for.
   * @returns - The retrieved value.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(sessionId: string, key: string): Promise<any> {
    throw new Error("get method not implemented");
  }

  /**
   * Retrieves all data associated with a given session ID.
   * @param sessionId - The ID of the session.
   * @returns - A promise that resolves to an object containing the retrieved data.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAll(sessionId: string): Promise<any> {
    throw new Error("getAll method not implemented");
  }

  /**
   * Saves a file to the storage.
   * @param filename - The name of the file to be saved.
   * @param data - The data to be saved in the file.
   * @returns - A promise that resolves when the file is saved successfully.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveFile(filename: string, data: Buffer): Promise<void> {
    throw new Error("saveFile method not implemented");
  }

  /**
   * Reads a file from the storage.
   * @param filename - The name of the file to read.
   * @returns - A promise that resolves with the file content as a Buffer.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readFile(filename: string): Promise<Buffer> {
    throw new Error("readFile method not implemented");
  }
}

/**
 * Represents a cloud storage for storing and retrieving data.
 */
class CloudStorage extends Storage {
  _bucket: Bucket;
  _version: string;

  /**
   * Constructs a new instance of the CloudStorage class.
   * @param projectIdOrCreds - The project ID or credentials for the Google Cloud Storage.
   * @param bucketName - The name of the bucket.
   * @param appVersion - The version of the application.
   */
  constructor(
    projectIdOrCreds: string | any,
    bucketName: string,
    appVersion: string,
  ) {
    super();
    const storageOpts =
      typeof projectIdOrCreds === "string"
        ? {projectId: projectIdOrCreds}
        : {
            projectId: projectIdOrCreds.projectId,
            credentials: projectIdOrCreds,
          };
    const storage = new GAEStorage(storageOpts);
    this._bucket = storage.bucket(bucketName);
    // appVersion is used as a prefix for all paths, so that multiple
    // deployments can use the same bucket without risk of collision.
    this._version = appVersion;
  }

  /**
   * Saves a value to the specified session and key.
   * @param sessionId - The session ID.
   * @param key - The key to store the value under.
   * @param value - The value to be stored.
   */
  async put(sessionId, key, value) {
    assert(sessionId.length > 0);
    const name = `${this._version}/sessions/${sessionId}/${encodeURIComponent(
      key,
    )}`;
    const file = this._bucket.file(name);
    const data = JSON.stringify(value);
    await file.save(data);
  }

  /**
   * Retrieves the value associated with the specified session and key.
   * @param sessionId - The session ID.
   * @param key - The key to retrieve the value for.
   * @returns - The retrieved value.
   */
  async get(sessionId: string, key: string): Promise<Extensions | TestResult> {
    assert(sessionId.length > 0);
    const name = `${this._version}/sessions/${sessionId}/${encodeURIComponent(
      key,
    )}`;
    const file = this._bucket.file(name);
    const data = (await file.download())[0];
    const result = JSON.parse(data.toString());
    if (key === "extensions") {
      return result as Extensions;
    }
    return result as TestResult;
  }

  /**
   * Retrieves all data associated with a given session ID.
   * @param sessionId - The ID of the session.
   * @returns - A promise that resolves to an object containing the retrieved data.
   */
  async getAll(sessionId: string): Promise<ReportStore> {
    assert(sessionId.length > 0);
    const prefix = `${this._version}/sessions/${sessionId}/`;
    const files = (await this._bucket.getFiles({prefix}))[0];
    const result: ReportStore = {};
    await Promise.all(
      files.map(async (file) => {
        assert(file.name.startsWith(prefix));
        const key = decodeURIComponent(file.name.substring(prefix.length));
        const data = (await file.download())[0];
        result[key] = JSON.parse(data.toString());
      }),
    );
    return result;
  }

  /**
   * Saves a file to the storage.
   * @param filename - The name of the file to be saved.
   * @param data - The data to be saved in the file.
   * @returns - A promise that resolves when the file is saved successfully.
   */
  async saveFile(filename, data) {
    assert(!filename.includes(".."));
    const name = `${this._version}/files/${filename}`;
    const file = this._bucket.file(name);
    await file.save(data);
  }

  /**
   * Reads a file from the storage.
   * @param filename - The name of the file to read.
   * @returns - A promise that resolves with the file content as a Buffer.
   */
  async readFile(filename: string): Promise<Buffer> {
    assert(!filename.includes(".."));
    const name = `${this._version}/files/${filename}`;
    const file = this._bucket.file(name);
    return (await file.download())[0];
  }
}

/**
 * Represents a memory storage for storing and retrieving data.
 */
class MemoryStorage extends Storage {
  _data: Map<string, any>;

  /**
   * Constructs a new instance of the MemoryStorage class.
   */
  constructor() {
    super();
    this._data = new Map();
  }

  /**
   * Stores a key-value pair in the session data for a given session ID.
   * If the session ID does not exist, a new session data map is created.
   * @param sessionId - The ID of the session.
   * @param key - The key of the data to be stored.
   * @param value - The value to be stored.
   * @returns - A promise that resolves when the data is successfully stored.
   */
  async put(sessionId, key, value) {
    let sessionData: Map<string, any>;
    if (this._data.has(sessionId)) {
      sessionData = this._data.get(sessionId);
    } else {
      sessionData = new Map();
      this._data.set(sessionId, sessionData);
    }
    sessionData.set(key, value);
  }

  /**
   * Retrieves the value associated with the specified key in the session data.
   * @param sessionId - The identifier of the session.
   * @param key - The key of the value to retrieve.
   * @returns The value associated with the specified key, or undefined if the key does not exist.
   */
  async get(
    sessionId: string,
    key: string,
  ): Promise<Extensions | TestResult | undefined> {
    const sessionData = this._data.get(sessionId);
    if (!(sessionData && key in sessionData)) {
      return undefined;
    }
    if (key === "extensions") {
      return sessionData[key] as Extensions;
    }
    return sessionData[key] as TestResult;
  }

  /**
   * Retrieves all data associated with a given session ID.
   * @param sessionId - The ID of the session.
   * @returns - A promise that resolves to an object containing all the data associated with the session.
   */
  async getAll(sessionId: string): Promise<ReportStore> {
    const result: ReportStore = {};
    const sessionData = this._data.get(sessionId);
    if (sessionData) {
      for (const [key, value] of sessionData) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Saves a file to the specified location.
   * @param filename - The name of the file to be saved.
   * @param data - The data to be written to the file.
   * @returns - A promise that resolves when the file is successfully saved.
   */
  async saveFile(filename: string, data: Buffer): Promise<void> {
    const downloadsPath = new URL(`../download`, import.meta.url);
    if (!fs.existsSync(downloadsPath)) {
      await fs.mkdir(downloadsPath);
    }

    assert(!filename.includes(".."));
    await fs.writeFile(
      new URL(`../download/${filename}`, import.meta.url),
      data,
    );
  }

  /**
   * Reads a file asynchronously.
   * @param filename - The name of the file to read.
   * @returns - A promise that resolves with the contents of the file as a Buffer.
   */
  async readFile(filename: string): Promise<Buffer> {
    assert(!filename.includes(".."));
    return await fs.readFile(
      new URL(`../download/${filename}`, import.meta.url),
    );
  }
}

/**
 * Retrieves the appropriate storage based on the provided app version.
 * If running on Google App Engine, it uses CloudStorage with the specified bucket name.
 * If running on Heroku with the HDrive add-on, it uses CloudStorage with the specified bucket name and HDrive credentials.
 * Otherwise, it uses MemoryStorage for local deployment and testing.
 * @param appVersion - The version of the application.
 * @returns - The storage instance.
 */
const getStorage = (appVersion: string): Storage => {
  // Use CloudStorage on Google App Engine.
  const gaeproject: string | undefined = process.env.GOOGLE_CLOUD_PROJECT;
  if (gaeproject) {
    // Use GCLOUD_STORAGE_BUCKET from app.yaml.
    const bucketName: string = process.env.GCLOUD_STORAGE_BUCKET || "";
    return new CloudStorage(gaeproject, bucketName, appVersion);
  }

  // Use CloudStorage on Heroku + HDrive (Google Cloud).
  const hdrive: string | null = JSON.parse(
    process.env.HDRIVE_GOOGLE_JSON_KEY || "null",
  );
  if (hdrive) {
    const bucketName: string = process.env.HDRIVE_GOOGLE_BUCKET || "";
    return new CloudStorage(hdrive, bucketName, appVersion);
  }

  // Use MemoryStorage storage for local deployment and testing.
  return new MemoryStorage();
};

export {CloudStorage, MemoryStorage, getStorage};
