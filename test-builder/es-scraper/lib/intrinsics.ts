import { assert, getSpec } from "./utils.js";
import type {
  JSGlobal,
  JSClass,
  JSNamespace,
  JSGlobalProperty,
  JSFunction,
  JSMethod,
  JSConstructor,
  JSProperty,
  Parameters,
  DataAttributes,
} from "../src/types.js";
import { type Section } from "./types.js";

const $ = await getSpec();

function getBareSection(section: Section): Section {
  assert(
    section.children.every(
      (s) =>
        /^[A-Z][A-Za-z]+\s*\(|^`|Record$/u.test(s.title) &&
        s.children.length === 0,
    ) ||
      section.children.filter((s) => /^get |^set /.test(s.title)).length === 2,
    `Not all children are AOs/type-defs for ${section.title}`,
  );
  return section;
}

function parseParameters(title: string): [string, Parameters] {
  const { name, parameters } = title
    .replace(/(?<!,) /gu, "")
    .match(/(?<name>.*)\((?<parameters>.*)\)/u)!.groups!;
  const count = parameters!.trim() ? parameters!.split(",").length : 0;
  const optional = parameters!.split("[").length - 1;
  const rest = parameters!.includes("...");
  return [
    `${name!}()`,
    { required: count - optional - Number(rest), optional, rest },
  ];
}

function makeMethod(s: Section): JSMethod {
  const attributes = getAttributes(s);
  const [name, parameters] = parseParameters(s.title);
  const paras = $(`#${cleanID(s.id)} > p`)
    .map((_, el) => $(el).text())
    .filter((_, text) => text.includes('The *"length"* property of this'))
    .get();
  let length: number | undefined = undefined;
  if (paras.length !== 0) {
    assert(paras.length === 1);
    const explicitLength = paras[0]!.match(
      /The \*"length"\* property of this (?:method|function) is \*(?<length>\d+)\*/u,
    )!.groups!.length!;
    length = Number(explicitLength);
  }
  return { type: "method", name, id: s.id, parameters, attributes, length };
}

function makeConstructor(s: Section | undefined): JSConstructor | null {
  if (!s) return null;
  const ctorMain = s.children[0];
  assert(
    ctorMain?.title.endsWith(")"),
    "Constructor section does not specify constructor",
  );
  const [name, parameters] = parseParameters(ctorMain!.title);
  const paras = $(`#${cleanID(s.id)} > ul > li`)
    .map((_, el) => $(el).text())
    .get();
  function hasMention(text: string): boolean {
    return paras.some((t) => t.includes(text));
  }
  function getUsage(): JSConstructor["usage"] {
    if (hasMention("is equivalent to the object creation expression"))
      return "equivalent";
    if (hasMention("is not intended to be called as a function"))
      return "construct";
    if (hasMention("will throw an error when invoked")) return "none";
    assert(
      hasMention("when called as a function"),
      `Unknown usage: ${s!.title}`,
    );
    if (hasMention("when called as a constructor")) return "different";
    return "call";
  }
  return {
    type: "constructor",
    name,
    id: s.id,
    parameters,
    // To be populated later
    length: undefined,
    usage: getUsage(),
  };
}

function makeProperty(s: Section): JSProperty {
  if (s.children.filter((t) => /^get |^set /.test(t.title)).length === 2) {
    return {
      type: "accessor-property",
      name: s.title.replaceAll(" ", ""),
      id: s.id,
      attributes: "gsc",
    };
  } else if (/^get |^set /.test(s.title)) {
    return {
      type: "accessor-property",
      name: s.title.slice(4).replaceAll(" ", ""),
      id: s.id,
      attributes: `${/^get /.test(s.title) ? "g" : ""}${
        /^set /.test(s.title) ? "s" : ""
      }c`,
    };
  }
  return {
    type: "data-property",
    name: s.title.replaceAll(" ", ""),
    id: s.id,
    attributes: getAttributes(s) ?? "wc",
  };
}

function makeNamespace(s: Section): JSNamespace {
  let staticPropSecs = getSubsections(s, /Value Properties of/u)[1];
  let staticMethodSecs = getSubsections(s, /Function Properties of/u)[1];
  assert(staticPropSecs.every((p) => !p.title.endsWith(")")));
  assert(staticMethodSecs.every((p) => p.title.endsWith(")")));
  if (!staticPropSecs.length && !staticMethodSecs.length) {
    const props = s.children.map(getBareSection);
    staticPropSecs = props.filter(
      (p) => !/\)$|Abstract Operations|Objects$/.test(p.title),
    );
    staticMethodSecs = props.filter((p) => p.title.endsWith(")"));
  }
  const staticProperties = staticPropSecs.map(makeProperty);
  const staticMethods = staticMethodSecs.map(makeMethod);
  return {
    type: "namespace",
    name: s.title.replace(/^The | Object$/gu, ""),
    id: s.id,
    global: false,
    staticProperties,
    staticMethods,
  };
}

function makeClass(s: Section): JSClass {
  const [ctorPropSec, staticPropSecs] = getSubsections(
    s,
    /Properties of (?:.* Constructor|the %TypedArray% Intrinsic Object)/u,
  );
  const [, instancePropSecs] = getSubsections(s, /.* Instances/u);
  const [protoSec, protoPropSecs] = getSubsections(
    s,
    /Properties of .* Prototype Object/u,
  );
  const [ctorSection] = getSubsections(
    s,
    /The (?:.* Constructor|%TypedArray% Intrinsic Object)/u,
  );
  assert(instancePropSecs.every((p) => !p.title.endsWith(")")));
  function makeProperties(sections: Section[], method: false): JSProperty[];
  function makeProperties(sections: Section[], method: true): JSMethod[];
  function makeProperties(
    sections: Section[],
    method: boolean,
  ): JSProperty[] | JSMethod[] {
    return (
      sections
        .filter((p) => p.title.endsWith(")") === method)
        // @ts-expect-error: this is because of weak inference
        .map(method ? makeMethod : makeProperty)
    );
  }
  const staticProperties = makeProperties(staticPropSecs, false);
  const staticMethods = makeProperties(staticPropSecs, true);
  const prototypeProperties = makeProperties(protoPropSecs, false);
  const instanceMethods = makeProperties(protoPropSecs, true);
  const instanceProperties = instancePropSecs.map(makeProperty);
  const ctor = makeConstructor(ctorSection);
  if (ctorPropSec) {
    assert(ctor);
    const ctorLengthProp = $(`#${cleanID(ctorPropSec.id)} > ul > li`)
      .map((_, el) => $(el).text())
      .filter((_, text) => text.includes('has a *"length"* property'))
      .get();
    if (ctorLengthProp.length) {
      ctor.length = Number(
        ctorLengthProp[0]!.match(/whose value is \*(?<value>\d+)\*/u)!.groups!
          .value!,
      );
    }
  }
  const ctorProto = getPrototype(ctorPropSec);
  const protoProto = getPrototype(protoSec);
  function getExtends() {
    if (
      ctorProto === "%Function.prototype%" &&
      protoProto === "%Object.prototype%"
    )
      return undefined;
    if (ctorProto === "%Function.prototype%" && protoProto === "*null*")
      return "null";
    if (protoProto && ctorProto === protoProto.replace(".prototype", ""))
      return ctorProto.replaceAll("%", "");
    if (ctorProto === "%Function.prototype%" && !protoProto) return "N/A";
    if (!ctorProto && protoProto) return protoProto;
    throw new Error(`Unexpected extends: ${ctorProto}, ${protoProto}`);
  }
  return {
    type: "class",
    name: s.title.replace(/ Objects| \(.*\)/gu, ""),
    id: s.id,
    global: false,
    extends: getExtends(),
    ctor,
    staticProperties,
    staticMethods,
    prototypeProperties,
    instanceMethods,
    instanceProperties,
  };
}

function makeFunction(s: Section): JSFunction {
  const [name, parameters] = parseParameters(getBareSection(s).title);
  return { type: "function", name, parameters, id: s.id, global: true };
}

function makeGlobalProperty(s: Section): JSGlobalProperty {
  const section = getBareSection(s);
  return {
    type: "global-property",
    name: section.title,
    id: section.id,
    attributes: getAttributes(section)!,
  };
}

function getSubsections(s: Section, pattern: RegExp) {
  const section = s.children.find((c) => pattern.test(c.title));
  return [section, section?.children.map(getBareSection) ?? []] as const;
}

function getAttributes(s: Section): DataAttributes | undefined {
  const paras = $(`#${cleanID(s.id)} > p`)
    .map((_, el) => $(el).text())
    .filter((_, text) => text.includes("has the attributes"))
    .get();
  if (paras.length === 0) return undefined;
  assert(
    paras.length === 1,
    `Expected ${s.title} to have 1 attributes paragraph`,
  );
  const attributes = paras[0]!.match(
    /has the attributes \{ \[\[Writable\]\]: \*(?<writable>true|false)\*, \[\[Enumerable\]\]: \*(?<enumerable>true|false)\*, \[\[Configurable\]\]: \*(?<configurable>true|false)\* \}\./u,
  )!.groups!;
  return `${attributes.writable === "true" ? "w" : ""}${
    attributes.enumerable === "true" ? "e" : ""
  }${attributes.configurable === "true" ? "c" : ""}`;
}

function getPrototype(s: Section | undefined): string | undefined {
  if (!s) return undefined;
  const paras = $(`#${cleanID(s.id)} > ul > li`)
    .map((_, el) => $(el).text())
    .filter((_, text) => text.includes("has a [[Prototype]] internal slot"))
    .get();
  assert(paras.length === 1, `Prototype not found for ${s.title}`);
  return paras[0]!.match(
    /has a \[\[Prototype\]\] internal slot whose value is (?<proto>%.*%|\*null\*)\./u,
  )!.groups!.proto!;
}

function expandAbstractClass(
  s: JSClass,
  abstractName: string,
  subclasses: string[],
): JSGlobal[] {
  const toExpand = [
    "staticProperties",
    "staticMethods",
    "prototypeProperties",
    "instanceMethods",
  ] as const;
  function expandSection<T extends { name: string } | null>(
    p: T,
    name: string,
  ): T {
    if (!p) return null as T;
    return { ...p, name: p.name.replace(abstractName, name) };
  }
  return subclasses.map((t) => ({
    ...s,
    name: t,
    ctor: expandSection(s.ctor, t),
    ...Object.fromEntries(
      toExpand.map((k) => [k, s[k].map((p) => expandSection(p, t))]),
    ),
  }));
}

function cleanID(id: string): string {
  return id.replaceAll(/[.@%]/g, "\\$&");
}

export function collectIntrinsics(toc: Section[]): JSGlobal[] {
  const typedArrayTypes = $("#table-the-typedarray-constructors dfn")
    .map((_, el) => $(el).text().replaceAll("%", ""))
    .get();

  const errorTypes = $("#sec-native-error-types-used-in-this-standard dfn")
    .map((_, el) => $(el).text().replaceAll("%", ""))
    .get();

  const objects = toc
    .slice(
      toc.findIndex((s) => s.title === "Fundamental Objects"),
      toc.findIndex((s) => s.title === "Reflection") + 1,
    )
    .flatMap((s) => s.children)
    .flatMap((s) => {
      if (s.title === "Error Objects") {
        const endOfError =
          s.children.findIndex(
            (t) => t.title === "Properties of Error Instances",
          ) + 1;
        const subItems = s.children.slice(endOfError, -1);
        const [nativeErrorTypes, nativeErrorStructure, ...otherErrors] =
          subItems;
        assert(
          nativeErrorTypes!.title ===
            "Native Error Types Used in This Standard",
        );
        assert(
          nativeErrorStructure!.title === "_NativeError_ Object Structure",
        );
        // The nativeErrorTypes are already extracted in errorTypes; they will
        // be backfilled later
        return [
          { ...s, children: s.children.slice(0, endOfError) },
          nativeErrorStructure!,
          ...otherErrors,
        ];
      } else if (s.title === "TypedArray Objects") {
        const endOfTA =
          s.children.findIndex(
            (t) => t.title === "Abstract Operations for TypedArray Objects",
          ) + 1;
        return [
          { ...s, children: s.children.slice(0, endOfTA) },
          { ...s, title: "_TypedArray_", children: s.children.slice(endOfTA) },
        ];
      } else if (s.title === "Object Objects") {
        const prototypeProps = s.children.findIndex(
          (t) => t.title === "Properties of the Object Prototype Object",
        );
        const prototypePropsSection = s.children[prototypeProps]!;
        return {
          ...s,
          children: s.children.toSpliced(prototypeProps, 1, {
            ...prototypePropsSection,
            children: prototypePropsSection.children.flatMap((t) =>
              t.title === "Legacy Object.prototype Accessor Methods"
                ? t.children
                : t,
            ),
          }),
        };
      } else if (s.title === "Iteration") {
        return [
          s.children.find((t) => t.title === "The %IteratorPrototype% Object")!,
          s.children.find(
            (t) => t.title === "The %AsyncIteratorPrototype% Object",
          )!,
        ];
      } else if (s.title === "Module Namespace Objects") {
        // No page for this
        return [];
      } else if (s.title === "The Atomics Object") {
        // Remove WaiterList things
        return { ...s, children: s.children.slice(3) };
      }
      return s;
    })
    .map((s) => (s.title.endsWith("Object") ? makeNamespace(s) : makeClass(s)))
    .flatMap((s) => {
      if (s.name === "_TypedArray_") {
        return expandAbstractClass(
          s as JSClass,
          "_TypedArray_",
          typedArrayTypes,
        );
      } else if (s.name === "_NativeError_ Object Structure") {
        return expandAbstractClass(s as JSClass, "_NativeError_", errorTypes);
      }
      return s;
    });

  const globals = toc.find((s) => s.title === "The Global Object")!.children;
  assert(
    globals.length === 4 &&
      globals[0]!.title === "Value Properties of the Global Object" &&
      globals[1]!.title === "Function Properties of the Global Object" &&
      globals[2]!.title === "Constructor Properties of the Global Object" &&
      globals[3]!.title === "Other Properties of the Global Object",
    "Unexpected global object structure",
  );
  objects.push(
    ...globals[0]!.children.map(makeGlobalProperty),
    ...globals[1]!.children
      .flatMap((s) =>
        s.title === "URI Handling Functions"
          ? s.children.filter((t) => !/^[A-Z]/u.test(t.title))
          : s,
      )
      .map(makeFunction),
  );
  globals[2]!.children.forEach((s) => {
    const title = getBareSection(s).title.replace(" ( . . . )", "");
    const obj = objects.find((o) => o.name === title);
    assert(obj?.type === "class", `${title} is not a class`);
    obj.global = true;
  });
  globals[3]!.children.forEach((s) => {
    const title = getBareSection(s).title;
    const obj = objects.find((o) => o.name === title);
    assert(obj?.type === "namespace", `${title} is not a namespace`);
    obj.global = true;
  });

  toc
    .find((s) => s.title === "Additional ECMAScript Features for Web Browsers")!
    .children.find((s) => s.title === "Additional Built-in Properties")!
    .children.forEach((s) => {
      const target = s.title.match(
        /Additional Properties of the (?<name>.*) Object/u,
      )!.groups!.name!;
      assert(
        s.children.every((t) => t.title.endsWith(")")),
        "Annex B must be all functions",
      );
      if (target === "Global") {
        objects.push(...s.children.map(makeFunction));
      } else {
        const cls = target.replace(".prototype", "");
        const obj = objects.find((o) => o.name === cls);
        assert(obj?.type === "class", `${target} is not a class`);
        obj.instanceMethods.push(...s.children.map(makeMethod));
      }
    });
  return objects;
}
