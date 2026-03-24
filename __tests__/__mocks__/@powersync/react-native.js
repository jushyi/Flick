/**
 * Mock for @powersync/react-native
 * PowerSync has native modules that cannot run in Jest.
 */

class PowerSyncDatabase {
  constructor() {
    this.schema = null;
  }

  async init() {
    return Promise.resolve();
  }

  async connect() {
    return Promise.resolve();
  }

  async disconnectAndClear() {
    return Promise.resolve();
  }

  async getNextCrudTransaction() {
    return null;
  }

  async execute() {
    return { rows: { _array: [] } };
  }

  async getAll() {
    return [];
  }
}

const column = {
  text: 'TEXT',
  integer: 'INTEGER',
  real: 'REAL',
};

class Schema {
  constructor(tables) {
    this.tables = tables;
    this.types = {};
  }
}

class Table {
  constructor(columns, options) {
    this.columns = columns;
    this.options = options;
  }
}

class AbstractPowerSyncDatabase {}

const UpdateType = {
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
};

class PowerSyncBackendConnector {}

module.exports = {
  PowerSyncDatabase,
  Schema,
  Table,
  column,
  AbstractPowerSyncDatabase,
  UpdateType,
  PowerSyncBackendConnector,
};
