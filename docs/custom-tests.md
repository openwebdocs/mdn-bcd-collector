# Custom tests

The collector generates simple tests for most features, but sometimes these simple tests may be ineffective for certain features. In these cases, tests can also be written manually.

The `custom/tests.yaml` file is used to write custom tests for features that cannot be tested with auto-generated test statements (for example, WebGL extensions).

Custom tests are written in the following structure:

```yaml
FEATURE_1:
  FEATURE_2:
    __resources:
      - foobar
    __base: doSomething();
    __test: return doTheTest();
    FEATURE_3: return doTheOtherTest();
    FEATURE_4:
      __base: doSomethingElse();
      __test: return doTheOtherOtherTest();
    __additional:
      FEATURE_3.OPTIONS_PARAMETER: "return doTheOtherTest({hello: 'world'});"
```

The structure of the YAML file closely adheres to BCD's own structure, where each feature is identified by a unique hierarchy of strings, with some slight differences. This is to ensure a seamless experience for BCD contributors. For example, to define a custom test for `api.Document.body`, write the following YAML:

```yaml
api:
  Document:
    body: (code goes here)

    # ...or...

    body:
      __test: (code goes here)
```

> [!NOTE]
> Defining a feature in this file does not directly generate tests, unless defined under the `__additional` property (which will be explained later). For example, defining a custom test for `api.FooBar.baz` in `custom/tests.yaml` will not generate the test for that feature.

> [!TIP]
> When writing custom tests, make sure to implement thorough feature checking as to not raise exceptions. Uncaught exceptions will result in a `null` result, meaning the collector doesn't know if it's supported or not.

Each feature test will compile into a function as follows: `function() {__base + __test}`

## Custom test structure

Each feature may either be a string or an object with the following properties:

- `__base`: Base code used across this test and every subfeature's test
- `__test`: Code used specifically for that test (does not bubble down to subtests)
- `__resources`: The list of reusable resources required for this test
- `__additional`: Additional tests to generate that cannot be defined in the source data

If the feature is set to a string, it will have the same effect as an object with `__test` set to the string value.

### `__base`

The `__base` property is the common code used to access the feature, such as to generate an interface instance. This is where you create your elements and set up your environment.

In the code defined in this variable, the instance of the interface being tested should be defined in a variable called `instance`. This will allow the build script to automatically generate tests for the instance and its members.

Sometimes, tests require promises and callbacks. To define a custom test as a promise, simply create a `promise` variable in place of `instance`, and the system will automatically create a promise instead. To define a custom test with callbacks, do not define `var instance` and instead call `callback(<instance_variable>)`, and the system will define the appropriate variables and functions.

`__base` also compounds as it travels down the feature tree. In the example at the top of this document, the resulting `__base` values will be:

```yaml
FEATURE_1:
  # Nothing
FEATURE_1.FEATURE_2: doSomething();
FEATURE_1.FEATURE_2.FEATURE_3: doSomething();
FEATURE_1.FEATURE_2.FEATURE_4: |-
  doSomething();
  doSomethingElse();
```

### `__test`

The `__test` property is the code used to test that specific feature, such as to test for the presence of an interface member, or to confirm a CSS property is supported. If there is a `__base` value, this code is appended to the end of said value.

In the code defined in this variable, a return statement should be declared that returns one of the following values:

- A boolean determining whether the feature is supported (`true`) or not (`false`)
- `null` if feature support cannot be determined
- An object containing:
  - A `result` property that is one of the two above values
  - An optional `message` property with a string explaining why or why not the feature is supported

### `__resources`

The `__resources` property is used to state what reusable resources are required for this test, as well as tests for all subfeatures. Resources are defined in a top-level `__resources` property, as explained above in the "Reusable resources" section.

This variable is a list of identifiers for reusable resources the collector should load before running the feature's test.

### `__additional`

The `__additional` property is used to define features that cannot be represented by the source data (for example, behavioral features, option parameters, etc.). This property should be used as sparingly as possible, and features should always be defined in the source data whenever possible.

For example, if you need to define code for an option parameter, you may do the following:

```yaml
api:
  AudioContext:
    __resources:
      - audioContext
    __base: var instance = reusableInstances.audioContext;
    __test: return 'AudioContext' in self;
    AudioContext:
      __additional:
        options_latencyHint_parameter: return bcd.testOptionParam(window.AudioContext || window.webkitAudioContext, 'constructor', 'latencyHint', 'playback');
        options_sampleRate_parameter: return bcd.testOptionParam(window.AudioContext || window.webkitAudioContext, 'constructor', 'sampleRate', '44100');
        options_sinkId_parameter: return bcd.testOptionParam(window.AudioContext || window.webkitAudioContext, 'constructor', 'sinkId', '');
```

This example will create tests for three BCD identifiers:

- api.AudioContext.AudioContext.options_latencyHint_parameter
- api.AudioContext.AudioContext.options_sampleRate_parameter
- api.AudioContext.AudioContext.options_sinkId_parameter

## Resources

Certain tests may require resources, like an image or a reusable instance. To allow the resources to load before running the tests, rather than create and add an element with JavaScript, we can define resources to be loaded through the top-level `__resources` object.

```yaml
__resources:
  RESOURCE_ID:
    type: RESOURCE_TYPE
    dependencies:
      - RESOURCE_DEPENDENCY_1
      - RESOURCE_DEPENDENCY_2
    src:
      - PATH_TO_RESOURCE
      - ALT_PATH_TO_RESOURCE
    other_parameters: XXX
```

Each resource is defined by an ID and a series of parameters that vary based on the resource type. These resources can then be referenced by obtaining an element with the ID `resource-[RESOURCE_ID]` (or for the `instance` type, a property on the global `reusableInstances` object, like `reusableInstances.[RESOURCE_ID]`).

All resource files should be placed in `/static/resources/custom-tests`.

Each resource type takes different parameters, as explained in detail below, but all types take the following parameters:

- `type`: A string stating the type of resource
- `dependencies`: An optional array containing the list of dependent resources that must be loaded as well

### `audio`/`video` resource

To create an audio or video element, use the `audio` or `video` type respectively. This type takes the following parameters:

- `src`: An array of source audio or video file(s) to load
- `subtitles`: An optional list of objects of subtitle files to load, each with the following parameters:
  - `label`: The subtitle label
  - `lang`: The subtitle language in ISO 639-1 format
  - `src`: A string containing the source VTT path

Example:

```yaml
__resources:
  audio-blip:
    type: audio
    src:
      - /media/blip.mp3
      - /media/blip.ogg
  video-blank:
    type: video
    src:
      - /media/blank.mp4
      - /media/blank.webm
    subtitles:
      - label: English
        lang: en
        src: /media/subtitles.vtt
```

Output:

```html
<audio id="resource-audio-blip">
  <source src="/resources/custom-tests/media/blip.mp3" />
  <source src="/resources/custom-tests/media/blip.ogg" />
</audio>

<video id="resource-video-blank">
  <source src="/resources/custom-tests/media/blank.mp4" />
  <source src="/resources/custom-tests/media/blank.webm" />
  <track
    label="English"
    kind="subtitles"
    srclang="en"
    src="/resources/custom-tests/media/subtitles.vtt"
  />
</video>
```

### `image` resource

To create an image element, use the `image` type. This type takes the following parameters:

- `src`: A string containing the source file path
- `alt`: A string containing the alt. text of the image

Example:

```yaml
__resources:
  image-black:
    type: image
    src: /media/black.png
    alt: A blank image
```

Output:

```html
<img
  id="resource-image-black"
  src="/resources/custom-tests/media/black.png"
  alt="A blank image"
/>
```

### `instance` resource

Unlike other resource types, this one is used to create JavaScript instances that can easily be reused across many tests. This type takes the following parameters:

- `src`: A string containing the JavaScript code to create the instance (like custom tests, this code is wrapped in a function that is immediately called)
- `callback`: An optional boolean stating whether the instance is loaded through a callback; if it is, set this to `true` and pass the instance through a predefined `callback(instance)` function

Example:

```yaml
__resources:
  audioContext:
    type: instance
    src: |-
      var constructor = window.AudioContext || window.webkitAudioContext;
      if (!constructor) {
        return null;
      }
      return new constructor();
```

Output:

```js
var reusableInstances = {};

reusableInstances.audioContext = (function () {
  var constructor = window.AudioContext || window.webkitAudioContext;
  if (!constructor) {
    return null;
  }
  return new constructor();
})();
```

## Importing code from other tests

Sometimes, some features will depend on the setup and configuration from other features, especially with APIs. To prevent repeating code, you can import code from other custom tests. To import another test, add the following string to the test code: `<%ident:varname%>`, where `ident` is the full identifier to import from, and `varname` is what to rename the `instance` variable from that test to.

For example, the following YAML...

```yaml
api:
  AudioContext:
    __base: var instance = new (window.AudioContext || window.webkitAudioContext)();
  AudioDestinationNode:
    __base: |-
      <%api.AudioContext:audioCtx%>
      var instance = audioCtx.destination;
```

...will compile into...

```javascript
bcd.addTest(
  "api.AudioContext",
  "(function() {var instance = new (window.AudioContext || window.webkitAudioContext)();})()",
  "Window",
);
bcd.addTest(
  "api.AudioDestinationNode",
  "(function() {var audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (!audioCtx) {return false}; var instance = audioCtx.destination;})()",
  "Window",
);
```

> [!NOTE]
> If the specified `ident` cannot be found, an error will be generated and thrown during the test run.

## Use ES3 features

Tests are intended to be run on as early of browser versions as possible, including Chrome 1, Firefox 1 and Safari 3. These older versions, however, do not support modern ES6 features. To maximize compatibility, perform the following in custom test code:

- Use `var` instead of `const`/`let`
- Do not use arrow functions
- Always implement thorough feature checking whenever possible
- Use non-invasive polyfills (e.g. `function consoleLog(msg) {}` instead of `console.log = function(msg) {};`)
