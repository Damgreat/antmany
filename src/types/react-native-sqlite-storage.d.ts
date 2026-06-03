declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    transaction(
      txCallback: (tx: Transaction) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;
    readTransaction(
      txCallback: (tx: Transaction) => void,
      errorCallback?: (error: SQLError) => void,
      successCallback?: () => void
    ): void;
    executeSql(
      sqlStatement: string,
      params?: any[],
      successCallback?: (tx: Transaction, resultSet: ResultSet) => void,
      errorCallback?: (error: SQLError) => void
    ): void;
    close(successCallback?: () => void, errorCallback?: (error: SQLError) => void): void;
  }

  export interface Transaction {
    executeSql(
      sqlStatement: string,
      params?: any[],
      successCallback?: (tx: Transaction, resultSet: ResultSet) => void,
      errorCallback?: (tx: Transaction, error: SQLError) => boolean
    ): void;
  }

  export interface ResultSet {
    insertId: number;
    rowsAffected: number;
    rows: {
      length: number;
      item(index: number): any;
      raw(): any[];
    };
  }

  export interface SQLError {
    code: number;
    message: string;
  }

  export interface OpenParams {
    name: string;
    location?: string;
    createFromLocation?: number | string;
    key?: string;
    readOnly?: boolean;
  }

  export function openDatabase(
    params: OpenParams,
    successCallback?: () => void,
    errorCallback?: (error: SQLError) => void
  ): SQLiteDatabase;

  export function deleteDatabase(
    params: OpenParams,
    successCallback?: () => void,
    errorCallback?: (error: SQLError) => void
  ): void;

  export function enablePromise(enabled: boolean): void;
} 