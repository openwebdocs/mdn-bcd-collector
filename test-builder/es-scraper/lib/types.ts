export type DataAttributes = `${"w" | ""}${"e" | ""}${"c" | ""}`;

export type JSProperty =
  | {
      type: "data-property";
      name: string;
      id: string;
      attributes: DataAttributes;
    }
  | {
      type: "accessor-property";
      name: string;
      id: string;
      attributes: `${"g" | ""}${"s" | ""}${"e" | ""}${"c" | ""}`;
    };

export type Parameters = { required: number; optional: number; rest: boolean };

export type JSMethod = {
  type: "method";
  name: string;
  id: string;
  parameters: Parameters;
  length: number | undefined;
  attributes: DataAttributes | undefined;
};

export type JSConstructor = {
  type: "constructor";
  name: string;
  id: string;
  length: number | undefined;
  parameters: Parameters;
  usage: "call" | "construct" | "equivalent" | "different" | "none";
};

export type JSNamespace = {
  type: "namespace";
  name: string;
  id: string;
  global: boolean;
  staticProperties: JSProperty[];
  staticMethods: JSMethod[];
};

export type JSClass = {
  type: "class";
  name: string;
  id: string;
  global: boolean;
  extends: string | undefined;
  ctor: JSConstructor | null;
  staticProperties: JSProperty[];
  staticMethods: JSMethod[];
  prototypeProperties: JSProperty[];
  instanceMethods: JSMethod[];
  instanceProperties: JSProperty[];
};

export type JSGlobalProperty = {
  type: "global-property";
  name: string;
  id: string;
  attributes: `${"w" | ""}${"e" | ""}${"c" | ""}`;
};

export type JSFunction = {
  type: "function";
  name: string;
  id: string;
  parameters: Parameters;
  length?: number;
  global: boolean;
};

export type JSGlobal = JSNamespace | JSClass | JSGlobalProperty | JSFunction;

export type Section = {
  title: string;
  id: string;
  children: Section[];
};
