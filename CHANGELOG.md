# mdn-bcd-collector Changelog

## v9.1.1

### Test Changes

#### Added

- api.HTMLFencedFrameElement.allow
- api.XRCompositionLayer.quality

#### Changed

- api.OES_texture_half_float_linear

### Commits

- Update subtitle
- Abstract test result clearing timeframe
- Update caveats list
- OES_texture_half_float_linear is only available in WebGL 1
- Mention Firefox's bug with CSS property values

## v9.1.0

### Test Changes

#### Added

- api.CSSImportRule.supportsText
- api.InterestGroupScriptRunnerGlobalScope
- api.VisibilityStateEntry
- css.properties.scroll-timeline-attachment
- css.properties.view-timeline-attachment

#### Changed

- api.AudioParamMap.@@iterator
- api.BluetoothManufacturerDataMap.@@iterator
- api.BluetoothServiceDataMap.@@iterator
- api.CSSFontFeatureValuesMap.@@iterator
- api.CSSNumericArray.@@iterator
- api.CSSTransformValue.@@iterator
- api.CSSUnparsedValue.@@iterator
- api.CustomStateSet.@@iterator
- api.EventCounts.@@iterator
- api.FileSystemDirectoryHandle.@@asyncIterator
- api.FontFacePalette.@@iterator
- api.FontFacePalettes.@@iterator
- api.FontFaceVariations.@@iterator
- api.GPUSupportedFeatures.@@iterator
- api.Headers.@@iterator
- api.Highlight.@@iterator
- api.HighlightRegistry.@@iterator
- api.KeyboardLayoutMap.@@iterator
- api.MediaKeyStatusMap.@@iterator
- api.MIDIInputMap.@@iterator
- api.MIDIOutputMap.@@iterator
- api.NamedFlowMap.@@iterator
- api.StylePropertyMapReadOnly.@@iterator
- api.WGSLLanguageFeatures.@@iterator
- api.XRAnchorSet.@@iterator
- api.XRHand.@@iterator
- api.XRInputSourceArray.@@iterator
- javascript.builtins.WebAssembly.Global
- javascript.builtins.WebAssembly.Instance
- javascript.builtins.WebAssembly.Memory
- javascript.builtins.WebAssembly.Module
- javascript.builtins.WebAssembly.Table

### Commits

- Fix testCSSProperty
- Update WebAssembly API tests
- Fix symbol tests for interfaces

## v9.0.4

### Test Changes

#### Changed

- api.CSSStyleDeclaration.@@iterator
- api.DOMTokenList.@@iterator
- api.FontFaceSet.@@iterator
- api.FormData.@@iterator
- api.NodeList.@@iterator
- api.ReadableStream.@@asyncIterator
- api.RTCStatsReport.@@iterator
- api.URLSearchParams.@@iterator
- javascript.builtins.AsyncFunction
- javascript.builtins.AsyncGenerator
- javascript.builtins.AsyncGeneratorFunction
- javascript.builtins.AsyncIterator
- javascript.builtins.Error
- javascript.builtins.Generator.next
- javascript.builtins.Generator.return
- javascript.builtins.Generator.throw
- javascript.builtins.Iterator
- javascript.builtins.RegExp
- javascript.builtins.TypedArray
- javascript.builtins.Intl.Collator
- javascript.builtins.Intl.DateTimeFormat
- javascript.builtins.Intl.DisplayNames
- javascript.builtins.Intl.ListFormat
- javascript.builtins.Intl.Locale
- javascript.builtins.Intl.NumberFormat
- javascript.builtins.Intl.PluralRules
- javascript.builtins.Intl.RelativeTimeFormat
- javascript.builtins.Intl.Segmenter
- javascript.builtins.Intl.Segments
- javascript.builtins.WebAssembly.Tag

### Commits

- Add .prototype in JavaScript feature list where needed
- Sort custom tests
- Fix when exact custom test match is needed for JavaScript features
- Fix automatic test generation for Symbol

## v9.0.3

### Test Changes

#### Changed

- api.AudioParamMap.@@iterator
- api.BluetoothManufacturerDataMap.@@iterator
- api.BluetoothServiceDataMap.@@iterator
- api.CSSFontFeatureValuesMap.@@iterator
- api.CSSNumericArray.@@iterator
- api.CSSStyleDeclaration.@@iterator
- api.CSSTransformValue.@@iterator
- api.CSSUnparsedValue.@@iterator
- api.CustomStateSet.@@iterator
- api.DOMTokenList.@@iterator
- api.EventCounts.@@iterator
- api.FileSystemDirectoryHandle.@@asyncIterator
- api.FontFacePalette.@@iterator
- api.FontFacePalettes.@@iterator
- api.FontFaceSet.@@iterator
- api.FontFaceVariations.@@iterator
- api.FormData.@@iterator
- api.GPUSupportedFeatures.@@iterator
- api.Headers.@@iterator
- api.Highlight.@@iterator
- api.HighlightRegistry.@@iterator
- api.HTMLAudioElement.Audio
- api.HTMLImageElement.Image
- api.HTMLOptionElement.Option
- api.KeyboardLayoutMap.@@iterator
- api.MediaKeyStatusMap.@@iterator
- api.MIDIInputMap.@@iterator
- api.MIDIOutputMap.@@iterator
- api.NamedFlowMap.@@iterator
- api.NodeList.@@iterator
- api.ReadableStream.@@asyncIterator
- api.RTCStatsReport.@@iterator
- api.SpeechGrammar
- api.SpeechGrammarList
- api.StylePropertyMapReadOnly.@@iterator
- api.URLSearchParams.@@iterator
- api.WGSLLanguageFeatures.@@iterator
- api.XRAnchorSet.@@iterator
- api.XRHand.@@iterator
- api.XRInputSourceArray.@@iterator
- javascript.builtins.Array.@@iterator
- javascript.builtins.Array.@@species
- javascript.builtins.Array.@@unscopables
- javascript.builtins.ArrayBuffer.@@species
- javascript.builtins.AsyncFunction
- javascript.builtins.AsyncGenerator
- javascript.builtins.AsyncGeneratorFunction
- javascript.builtins.AsyncIterator
- javascript.builtins.Date.@@toPrimitive
- javascript.builtins.Error
- javascript.builtins.Generator.next
- javascript.builtins.Generator.return
- javascript.builtins.Generator.throw
- javascript.builtins.Iterator
- javascript.builtins.Map.@@iterator
- javascript.builtins.Map.@@species
- javascript.builtins.Map.@@toStringTag
- javascript.builtins.RegExp
- javascript.builtins.Set.@@iterator
- javascript.builtins.Set.@@species
- javascript.builtins.String.@@iterator
- javascript.builtins.Symbol.@@toPrimitive
- javascript.builtins.TypedArray
- javascript.builtins.Intl.Collator
- javascript.builtins.Intl.DateTimeFormat
- javascript.builtins.Intl.DisplayNames
- javascript.builtins.Intl.@@toStringTag
- javascript.builtins.Intl.ListFormat
- javascript.builtins.Intl.Locale
- javascript.builtins.Intl.NumberFormat
- javascript.builtins.Intl.PluralRules
- javascript.builtins.Intl.RelativeTimeFormat
- javascript.builtins.Intl.Segmenter
- javascript.builtins.Intl.Segments
- javascript.builtins.WebAssembly.Tag

### Commits

- Add custom tests for SpeechGrammar and SpeechGrammarList
- Add custom tests for Audio/Image/Option constructors
- Always use index to get if Symbol is present vs. "in" syntax
- Fix RegExp feature definitions
- Require exact custom test match for static members of JS builtins
- Add custom tests for more JavaScript builtins
- Add custom test for supportedLocalesOf properties
- Remove export buttons if XHR is not supported

## v9.0.2

### Commits

- Fix export buttons
- Ignore Edge 79 on SauceLabs in Selenium script
- Disallow Node.js v20 for now

## v9.0.1

### Test Changes

#### Added

- api.FencedFrameConfig.containerHeight
- api.FencedFrameConfig.containerWidth
- api.FencedFrameConfig.contentHeight
- api.FencedFrameConfig.contentWidth
- api.FencedFrameConfig.setSharedStorageContext
- api.GPUSupportedLimits.maxBindGroupsPlusVertexBuffers
- api.XMLHttpRequest.setAttributionReporting

#### Removed

- api.FencedFrameConfig.FencedFrameConfig
- api.FencedFrameConfig.height
- api.FencedFrameConfig.width
- api.GPUSupportedLimits.maxFragmentCombinedOutputResources

#### Changed

- api.CSPViolationReportBody
- api.EventSource
- api.RTCPeerConnection.setLocalDescription.description_parameter_optional
- api.RTCPeerConnection.setLocalDescription.returns_promise
- api.RTCPeerConnection.setRemoteDescription.returns_promise
- api.WebSocket
- javascript.builtins.Array.@@species
- javascript.builtins.ArrayBuffer.@@species
- javascript.builtins.AsyncFunction
- javascript.builtins.AsyncGenerator
- javascript.builtins.AsyncGeneratorFunction
- javascript.builtins.AsyncIterator
- javascript.builtins.Map.@@species
- javascript.builtins.Object.constructor
- javascript.builtins.RegExp
- javascript.builtins.Set.@@species
- javascript.builtins.TypedArray
- javascript.builtins.Intl.Collator
- javascript.builtins.Intl.DateTimeFormat
- javascript.builtins.Intl.DisplayNames
- javascript.builtins.Intl.ListFormat
- javascript.builtins.Intl.Locale
- javascript.builtins.Intl.NumberFormat
- javascript.builtins.Intl.PluralRules
- javascript.builtins.Intl.RelativeTimeFormat
- javascript.builtins.Intl.Segmenter
- javascript.builtins.Intl.Segments

### Commits

- Mitigate a JavaScript bug with setting a variable inside a for loop
- Improve custom test for CSPViolationReportBody
- Add additional icons
- Separate resource loading into its own function
- Add additional custom tests for JavaScript builtins
- Always test Symbol.species presence not on prototype
- Add cleanup functions
- Add additional error catching to tests

## v9.0.0

### Notable changes

#### Custom tests infrastructure overhauled

The infrastructure to handle custom tests has been overhauled and revamped to consolidate internal code. This provides the following improvements:

- Reusable resources may be used on any category
- Any feature may define its own `__base`, `__test` and `__additional`, rather than just the top-level features
  - This allows additional tests to use base code they wouldn't otherwise have access to

#### Internal restructuring

The internals of this project have been significantly restructured to help keep the project root cleaner. All custom data has been moved to `custom/` (including tests, custom IDL, custom CSS and update-bcd overrides), scripts to `scripts/`, all test building to `test-builder/` (and separated into individual files), etc.

#### Documentation updates

The documentation of this project has been updated following recent changes and moved into a `docs/` folder. The DESIGN.md file was separated into multiple files for legibility purposes.

#### JavaScript test code improved

When tests for JavaScript builtins were introduced way back, they were barely touched and the codebase left a lot to be desired. As a part of the custom test infrastructure overhaul, test building code for JavaScript tests has been greatly improved. The `custom` property that was defined in `custom/js.json` is no longer and has been migrated to the custom tests system, which allows for usage of `__base` and `var instance` to reduce duplicate code.

#### Instance resources

Reusable instances have gotten some nice updates as well. They can be callbacks, as well as have their own dependencies for other resources.

### Test Changes

#### Added

- api.Document.requestStorageAccessFor
- api.Fence.getNestedConfigs
- api.Fence.setReportEventDataForAutomaticBeacons
- api.GPU.wgslLanguageFeatures
- api.InterestGroupBiddingScriptRunnerGlobalScope
- api.InterestGroupReportingScriptRunnerGlobalScope
- api.InterestGroupScoringScriptRunnerGlobalScope
- api.Navigator.leaveAdInterestGroup
- api.Navigator.updateAdInterestGroups
- api.RTCStatsReport.type_candidate-pair
- api.RTCStatsReport.type_certificate
- api.RTCStatsReport.type_codec
- api.RTCStatsReport.type_data-channel
- api.RTCStatsReport.type_inbound-rtp
- api.RTCStatsReport.type_local-candidate
- api.RTCStatsReport.type_media-playout
- api.RTCStatsReport.type_media-source
- api.RTCStatsReport.type_outbound-rtp
- api.RTCStatsReport.type_peer-connection
- api.RTCStatsReport.type_remote-candidate
- api.RTCStatsReport.type_remote-inbound-rtp
- api.RTCStatsReport.type_remote-outbound-rtp
- api.RTCStatsReport.type_transport
- api.URL.canParse
- api.WGSLLanguageFeatures
- css.properties.overlay
- css.properties.text-box-edge
- css.properties.text-box-trim
- css.properties.white-space-trim
- javascript.builtins.Array.fromAsync
- javascript.builtins.ArrayBuffer.maxByteLength
- javascript.builtins.ArrayBuffer.resizable
- javascript.builtins.ArrayBuffer.resize
- javascript.builtins.SharedArrayBuffer.grow
- javascript.builtins.SharedArrayBuffer.growable
- javascript.builtins.SharedArrayBuffer.maxByteLength
- javascript.builtins.String.isWellFormed
- javascript.builtins.String.toWellFormed

#### Removed

- api.BaseAudioContext.decodeAudioData.returns_promise
- api.Document.contains
- api.Document.requestStorageAccessForOrigin
- api.Navigator.clearClientBadge
- api.Navigator.setClientBadge
- api.PressureRecord.factors
- css.properties.leading-trim
- css.properties.text-edge
- css.properties.text-space-trim
- javascript.builtins.Function.displayName

#### Changed

- api.BaseAudioContext.createPeriodicWave.constraints_disableNormalization_parameter
- api.CSSStyleDeclaration.@@iterator
- api.Document.createElement.options_parameter
- api.Document.createElementNS.options_parameter
- api.DOMPoint.w
- api.DOMPoint.x
- api.DOMPoint.y
- api.DOMPoint.z
- api.DOMRect.height
- api.DOMRect.width
- api.DOMRect.x
- api.DOMRect.y
- api.DOMTokenList.@@iterator
- api.Element.attachShadow.init_delegatesFocus_parameter
- api.FontFaceSet.@@iterator
- api.FormData.@@iterator
- api.HTMLAudioElement.Audio
- api.HTMLImageElement.Image
- api.HTMLOptionElement.Option
- api.MediaStream
- api.MediaStreamAudioSourceNode
- api.MediaStreamEvent
- api.MediaStreamTrack
- api.MediaStreamTrackAudioSourceNode
- api.MediaStreamTrackEvent
- api.NodeList.@@iterator
- api.ReadableStream
- api.RTCStatsReport
- api.URLSearchParams.@@iterator
- api.URLSearchParams.URLSearchParams.record
- api.URLSearchParams.URLSearchParams.sequence
- javascript.builtins.Array.at
- javascript.builtins.Array.concat
- javascript.builtins.Array.copyWithin
- javascript.builtins.Array.entries
- javascript.builtins.Array.every
- javascript.builtins.Array.fill
- javascript.builtins.Array.filter
- javascript.builtins.Array.find
- javascript.builtins.Array.findIndex
- javascript.builtins.Array.findLast
- javascript.builtins.Array.findLastIndex
- javascript.builtins.Array.flat
- javascript.builtins.Array.flatMap
- javascript.builtins.Array.forEach
- javascript.builtins.Array.from
- javascript.builtins.Array.group
- javascript.builtins.Array.groupToMap
- javascript.builtins.Array.includes
- javascript.builtins.Array.indexOf
- javascript.builtins.Array.isArray
- javascript.builtins.Array.join
- javascript.builtins.Array.keys
- javascript.builtins.Array.lastIndexOf
- javascript.builtins.Array.length
- javascript.builtins.Array.map
- javascript.builtins.Array.of
- javascript.builtins.Array.pop
- javascript.builtins.Array.push
- javascript.builtins.Array.reduce
- javascript.builtins.Array.reduceRight
- javascript.builtins.Array.reverse
- javascript.builtins.Array.shift
- javascript.builtins.Array.slice
- javascript.builtins.Array.some
- javascript.builtins.Array.sort
- javascript.builtins.Array.splice
- javascript.builtins.Array.toLocaleString
- javascript.builtins.Array.toReversed
- javascript.builtins.Array.toSorted
- javascript.builtins.Array.toSource
- javascript.builtins.Array.toSpliced
- javascript.builtins.Array.toString
- javascript.builtins.Array.unshift
- javascript.builtins.Array.values
- javascript.builtins.Array.with
- javascript.builtins.Array.@@iterator
- javascript.builtins.Array.@@species
- javascript.builtins.Array.@@unscopables
- javascript.builtins.ArrayBuffer.byteLength
- javascript.builtins.ArrayBuffer.isView
- javascript.builtins.ArrayBuffer.slice
- javascript.builtins.ArrayBuffer.@@species
- javascript.builtins.AsyncFunction
- javascript.builtins.AsyncGenerator.next
- javascript.builtins.AsyncGenerator.return
- javascript.builtins.AsyncGenerator.throw
- javascript.builtins.AsyncGeneratorFunction
- javascript.builtins.AsyncIterator
- javascript.builtins.Atomics.add
- javascript.builtins.Atomics.and
- javascript.builtins.Atomics.compareExchange
- javascript.builtins.Atomics.exchange
- javascript.builtins.Atomics.isLockFree
- javascript.builtins.Atomics.load
- javascript.builtins.Atomics.notify
- javascript.builtins.Atomics.or
- javascript.builtins.Atomics.store
- javascript.builtins.Atomics.sub
- javascript.builtins.Atomics.wait
- javascript.builtins.Atomics.waitAsync
- javascript.builtins.Atomics.wake
- javascript.builtins.Atomics.xor
- javascript.builtins.BigInt.asIntN
- javascript.builtins.BigInt.asUintN
- javascript.builtins.BigInt.toLocaleString
- javascript.builtins.BigInt.toString
- javascript.builtins.BigInt.valueOf
- javascript.builtins.Boolean.toSource
- javascript.builtins.Boolean.toString
- javascript.builtins.Boolean.valueOf
- javascript.builtins.DataView.buffer
- javascript.builtins.DataView.byteLength
- javascript.builtins.DataView.byteOffset
- javascript.builtins.DataView.getBigInt64
- javascript.builtins.DataView.getBigUint64
- javascript.builtins.DataView.getFloat32
- javascript.builtins.DataView.getFloat64
- javascript.builtins.DataView.getInt16
- javascript.builtins.DataView.getInt32
- javascript.builtins.DataView.getInt8
- javascript.builtins.DataView.getUint16
- javascript.builtins.DataView.getUint32
- javascript.builtins.DataView.getUint8
- javascript.builtins.DataView.setBigInt64
- javascript.builtins.DataView.setBigUint64
- javascript.builtins.DataView.setFloat32
- javascript.builtins.DataView.setFloat64
- javascript.builtins.DataView.setInt16
- javascript.builtins.DataView.setInt32
- javascript.builtins.DataView.setInt8
- javascript.builtins.DataView.setUint16
- javascript.builtins.DataView.setUint32
- javascript.builtins.DataView.setUint8
- javascript.builtins.Date.getDate
- javascript.builtins.Date.getDay
- javascript.builtins.Date.getFullYear
- javascript.builtins.Date.getHours
- javascript.builtins.Date.getMilliseconds
- javascript.builtins.Date.getMinutes
- javascript.builtins.Date.getMonth
- javascript.builtins.Date.getSeconds
- javascript.builtins.Date.getTime
- javascript.builtins.Date.getTimezoneOffset
- javascript.builtins.Date.getUTCDate
- javascript.builtins.Date.getUTCDay
- javascript.builtins.Date.getUTCFullYear
- javascript.builtins.Date.getUTCHours
- javascript.builtins.Date.getUTCMilliseconds
- javascript.builtins.Date.getUTCMinutes
- javascript.builtins.Date.getUTCMonth
- javascript.builtins.Date.getUTCSeconds
- javascript.builtins.Date.getYear
- javascript.builtins.Date.now
- javascript.builtins.Date.parse
- javascript.builtins.Date.setDate
- javascript.builtins.Date.setFullYear
- javascript.builtins.Date.setHours
- javascript.builtins.Date.setMilliseconds
- javascript.builtins.Date.setMinutes
- javascript.builtins.Date.setMonth
- javascript.builtins.Date.setSeconds
- javascript.builtins.Date.setTime
- javascript.builtins.Date.setUTCDate
- javascript.builtins.Date.setUTCFullYear
- javascript.builtins.Date.setUTCHours
- javascript.builtins.Date.setUTCMilliseconds
- javascript.builtins.Date.setUTCMinutes
- javascript.builtins.Date.setUTCMonth
- javascript.builtins.Date.setUTCSeconds
- javascript.builtins.Date.setYear
- javascript.builtins.Date.toDateString
- javascript.builtins.Date.toGMTString
- javascript.builtins.Date.toISOString
- javascript.builtins.Date.toJSON
- javascript.builtins.Date.toLocaleDateString
- javascript.builtins.Date.toLocaleString
- javascript.builtins.Date.toLocaleTimeString
- javascript.builtins.Date.toSource
- javascript.builtins.Date.toString
- javascript.builtins.Date.toTimeString
- javascript.builtins.Date.toUTCString
- javascript.builtins.Date.UTC
- javascript.builtins.Date.valueOf
- javascript.builtins.Date.@@toPrimitive
- javascript.builtins.Error
- javascript.builtins.FinalizationRegistry.register
- javascript.builtins.FinalizationRegistry.unregister
- javascript.builtins.Function.apply
- javascript.builtins.Function.arguments
- javascript.builtins.Function.bind
- javascript.builtins.Function.call
- javascript.builtins.Function.caller
- javascript.builtins.Function.length
- javascript.builtins.Function.name
- javascript.builtins.Function.toSource
- javascript.builtins.Function.toString
- javascript.builtins.Generator
- javascript.builtins.GeneratorFunction
- javascript.builtins.Iterator
- javascript.builtins.JSON.parse
- javascript.builtins.JSON.stringify
- javascript.builtins.Map.clear
- javascript.builtins.Map.delete
- javascript.builtins.Map.entries
- javascript.builtins.Map.forEach
- javascript.builtins.Map.get
- javascript.builtins.Map.has
- javascript.builtins.Map.keys
- javascript.builtins.Map.set
- javascript.builtins.Map.size
- javascript.builtins.Map.values
- javascript.builtins.Map.@@iterator
- javascript.builtins.Map.@@species
- javascript.builtins.Map.@@toStringTag
- javascript.builtins.Math.E
- javascript.builtins.Math.LN2
- javascript.builtins.Math.LN10
- javascript.builtins.Math.LOG2E
- javascript.builtins.Math.LOG10E
- javascript.builtins.Math.PI
- javascript.builtins.Math.SQRT1_2
- javascript.builtins.Math.SQRT2
- javascript.builtins.Math.abs
- javascript.builtins.Math.acos
- javascript.builtins.Math.acosh
- javascript.builtins.Math.asin
- javascript.builtins.Math.asinh
- javascript.builtins.Math.atan
- javascript.builtins.Math.atan2
- javascript.builtins.Math.atanh
- javascript.builtins.Math.cbrt
- javascript.builtins.Math.ceil
- javascript.builtins.Math.clz32
- javascript.builtins.Math.cos
- javascript.builtins.Math.cosh
- javascript.builtins.Math.exp
- javascript.builtins.Math.expm1
- javascript.builtins.Math.floor
- javascript.builtins.Math.fround
- javascript.builtins.Math.hypot
- javascript.builtins.Math.imul
- javascript.builtins.Math.log
- javascript.builtins.Math.log1p
- javascript.builtins.Math.log2
- javascript.builtins.Math.log10
- javascript.builtins.Math.max
- javascript.builtins.Math.min
- javascript.builtins.Math.pow
- javascript.builtins.Math.random
- javascript.builtins.Math.round
- javascript.builtins.Math.sign
- javascript.builtins.Math.sin
- javascript.builtins.Math.sinh
- javascript.builtins.Math.sqrt
- javascript.builtins.Math.tan
- javascript.builtins.Math.tanh
- javascript.builtins.Math.trunc
- javascript.builtins.Number.EPSILON
- javascript.builtins.Number.MAX_SAFE_INTEGER
- javascript.builtins.Number.MAX_VALUE
- javascript.builtins.Number.MIN_SAFE_INTEGER
- javascript.builtins.Number.MIN_VALUE
- javascript.builtins.Number.NaN
- javascript.builtins.Number.NEGATIVE_INFINITY
- javascript.builtins.Number.POSITIVE_INFINITY
- javascript.builtins.Number.isFinite
- javascript.builtins.Number.isInteger
- javascript.builtins.Number.isNaN
- javascript.builtins.Number.isSafeInteger
- javascript.builtins.Number.parseFloat
- javascript.builtins.Number.parseInt
- javascript.builtins.Number.toExponential
- javascript.builtins.Number.toFixed
- javascript.builtins.Number.toLocaleString
- javascript.builtins.Number.toPrecision
- javascript.builtins.Number.toSource
- javascript.builtins.Number.toString
- javascript.builtins.Number.valueOf
- javascript.builtins.Object.assign
- javascript.builtins.Object.constructor
- javascript.builtins.Object.create
- javascript.builtins.Object.defineProperties
- javascript.builtins.Object.defineProperty
- javascript.builtins.Object.entries
- javascript.builtins.Object.freeze
- javascript.builtins.Object.fromEntries
- javascript.builtins.Object.getOwnPropertyDescriptor
- javascript.builtins.Object.getOwnPropertyDescriptors
- javascript.builtins.Object.getOwnPropertyNames
- javascript.builtins.Object.getOwnPropertySymbols
- javascript.builtins.Object.getPrototypeOf
- javascript.builtins.Object.hasOwn
- javascript.builtins.Object.hasOwnProperty
- javascript.builtins.Object.is
- javascript.builtins.Object.isExtensible
- javascript.builtins.Object.isFrozen
- javascript.builtins.Object.isPrototypeOf
- javascript.builtins.Object.isSealed
- javascript.builtins.Object.keys
- javascript.builtins.Object.preventExtensions
- javascript.builtins.Object.propertyIsEnumerable
- javascript.builtins.Object.seal
- javascript.builtins.Object.setPrototypeOf
- javascript.builtins.Object.toLocaleString
- javascript.builtins.Object.toSource
- javascript.builtins.Object.toString
- javascript.builtins.Object.valueOf
- javascript.builtins.Object.values
- javascript.builtins.Promise.all
- javascript.builtins.Promise.allSettled
- javascript.builtins.Promise.any
- javascript.builtins.Promise.catch
- javascript.builtins.Promise.finally
- javascript.builtins.Promise.race
- javascript.builtins.Promise.reject
- javascript.builtins.Promise.resolve
- javascript.builtins.Promise.then
- javascript.builtins.Proxy.revocable
- javascript.builtins.Reflect.apply
- javascript.builtins.Reflect.construct
- javascript.builtins.Reflect.defineProperty
- javascript.builtins.Reflect.deleteProperty
- javascript.builtins.Reflect.get
- javascript.builtins.Reflect.getOwnPropertyDescriptor
- javascript.builtins.Reflect.getPrototypeOf
- javascript.builtins.Reflect.has
- javascript.builtins.Reflect.isExtensible
- javascript.builtins.Reflect.ownKeys
- javascript.builtins.Reflect.preventExtensions
- javascript.builtins.Reflect.set
- javascript.builtins.Reflect.setPrototypeOf
- javascript.builtins.RegExp.compile
- javascript.builtins.RegExp.dotAll
- javascript.builtins.RegExp.exec
- javascript.builtins.RegExp.flags
- javascript.builtins.RegExp.global
- javascript.builtins.RegExp.hasIndices
- javascript.builtins.RegExp.ignoreCase
- javascript.builtins.RegExp.input
- javascript.builtins.RegExp.lastIndex
- javascript.builtins.RegExp.lastMatch
- javascript.builtins.RegExp.lastParen
- javascript.builtins.RegExp.leftContext
- javascript.builtins.RegExp.multiline
- javascript.builtins.RegExp.n
- javascript.builtins.RegExp.rightContext
- javascript.builtins.RegExp.source
- javascript.builtins.RegExp.sticky
- javascript.builtins.RegExp.test
- javascript.builtins.RegExp.toSource
- javascript.builtins.RegExp.toString
- javascript.builtins.RegExp.unicode
- javascript.builtins.RegExp.@@match
- javascript.builtins.RegExp.@@matchAll
- javascript.builtins.RegExp.@@replace
- javascript.builtins.RegExp.@@search
- javascript.builtins.RegExp.@@species
- javascript.builtins.RegExp.@@split
- javascript.builtins.Set.add
- javascript.builtins.Set.clear
- javascript.builtins.Set.delete
- javascript.builtins.Set.entries
- javascript.builtins.Set.forEach
- javascript.builtins.Set.has
- javascript.builtins.Set.keys
- javascript.builtins.Set.size
- javascript.builtins.Set.values
- javascript.builtins.Set.@@iterator
- javascript.builtins.Set.@@species
- javascript.builtins.SharedArrayBuffer.byteLength
- javascript.builtins.SharedArrayBuffer.slice
- javascript.builtins.String.anchor
- javascript.builtins.String.at
- javascript.builtins.String.big
- javascript.builtins.String.blink
- javascript.builtins.String.bold
- javascript.builtins.String.charAt
- javascript.builtins.String.charCodeAt
- javascript.builtins.String.codePointAt
- javascript.builtins.String.concat
- javascript.builtins.String.contains
- javascript.builtins.String.endsWith
- javascript.builtins.String.fixed
- javascript.builtins.String.fontcolor
- javascript.builtins.String.fontsize
- javascript.builtins.String.fromCharCode
- javascript.builtins.String.fromCodePoint
- javascript.builtins.String.includes
- javascript.builtins.String.indexOf
- javascript.builtins.String.italics
- javascript.builtins.String.lastIndexOf
- javascript.builtins.String.length
- javascript.builtins.String.link
- javascript.builtins.String.localeCompare
- javascript.builtins.String.match
- javascript.builtins.String.matchAll
- javascript.builtins.String.normalize
- javascript.builtins.String.padEnd
- javascript.builtins.String.padStart
- javascript.builtins.String.raw
- javascript.builtins.String.repeat
- javascript.builtins.String.replace
- javascript.builtins.String.replaceAll
- javascript.builtins.String.search
- javascript.builtins.String.slice
- javascript.builtins.String.small
- javascript.builtins.String.split
- javascript.builtins.String.startsWith
- javascript.builtins.String.strike
- javascript.builtins.String.sub
- javascript.builtins.String.substr
- javascript.builtins.String.substring
- javascript.builtins.String.sup
- javascript.builtins.String.toLocaleLowerCase
- javascript.builtins.String.toLocaleUpperCase
- javascript.builtins.String.toLowerCase
- javascript.builtins.String.toSource
- javascript.builtins.String.toString
- javascript.builtins.String.toUpperCase
- javascript.builtins.String.trim
- javascript.builtins.String.trimEnd
- javascript.builtins.String.trimLeft
- javascript.builtins.String.trimRight
- javascript.builtins.String.trimStart
- javascript.builtins.String.valueOf
- javascript.builtins.String.@@iterator
- javascript.builtins.Symbol.asyncIterator
- javascript.builtins.Symbol.description
- javascript.builtins.Symbol.for
- javascript.builtins.Symbol.hasInstance
- javascript.builtins.Symbol.isConcatSpreadable
- javascript.builtins.Symbol.iterator
- javascript.builtins.Symbol.keyFor
- javascript.builtins.Symbol.match
- javascript.builtins.Symbol.matchAll
- javascript.builtins.Symbol.replace
- javascript.builtins.Symbol.search
- javascript.builtins.Symbol.species
- javascript.builtins.Symbol.split
- javascript.builtins.Symbol.toPrimitive
- javascript.builtins.Symbol.toSource
- javascript.builtins.Symbol.toString
- javascript.builtins.Symbol.toStringTag
- javascript.builtins.Symbol.unscopables
- javascript.builtins.Symbol.valueOf
- javascript.builtins.Symbol.@@toPrimitive
- javascript.builtins.Temporal.Calendar
- javascript.builtins.Temporal.Duration
- javascript.builtins.Temporal.Instant
- javascript.builtins.Temporal.PlainDate
- javascript.builtins.Temporal.PlainDateTime
- javascript.builtins.Temporal.PlainMonthDay
- javascript.builtins.Temporal.PlainTime
- javascript.builtins.Temporal.PlainYearMonth
- javascript.builtins.Temporal.TimeZone
- javascript.builtins.Temporal.ZonedDateTime
- javascript.builtins.Temporal.now
- javascript.builtins.TypedArray
- javascript.builtins.WeakMap.clear
- javascript.builtins.WeakMap.delete
- javascript.builtins.WeakMap.get
- javascript.builtins.WeakMap.has
- javascript.builtins.WeakMap.set
- javascript.builtins.WeakRef.deref
- javascript.builtins.WeakSet.add
- javascript.builtins.WeakSet.delete
- javascript.builtins.WeakSet.has
- javascript.builtins.Intl.Collator
- javascript.builtins.Intl.DateTimeFormat
- javascript.builtins.Intl.DisplayNames
- javascript.builtins.Intl.getCanonicalLocales
- javascript.builtins.Intl.@@toStringTag
- javascript.builtins.Intl.ListFormat
- javascript.builtins.Intl.Locale
- javascript.builtins.Intl.NumberFormat
- javascript.builtins.Intl.PluralRules
- javascript.builtins.Intl.RelativeTimeFormat
- javascript.builtins.Intl.Segmenter
- javascript.builtins.Intl.Segments
- javascript.builtins.Intl.supportedValuesOf
- javascript.builtins.WebAssembly.CompileError
- javascript.builtins.WebAssembly.Exception
- javascript.builtins.WebAssembly.Global
- javascript.builtins.WebAssembly.Instance
- javascript.builtins.WebAssembly.LinkError
- javascript.builtins.WebAssembly.Memory
- javascript.builtins.WebAssembly.Module
- javascript.builtins.WebAssembly.RuntimeError
- javascript.builtins.WebAssembly.Table
- javascript.builtins.WebAssembly.Tag
- javascript.builtins.WebAssembly.compile
- javascript.builtins.WebAssembly.compileStreaming
- javascript.builtins.WebAssembly.instantiate
- javascript.builtins.WebAssembly.instantiateStreaming
- javascript.builtins.WebAssembly.validate

### Commits

- Update console errors on reusable instances
- Use dummy media stream when possible, instead of always using cam/mic
- Display the reusable instances code as separate reports
- Add custom tests for RTCStatsReport and stats types
- Add countdown timer to resource loading timeout
- Increase resource loading timeout
- Add cleanup function support
- Simplify harness.js code
- Set reusable instance to null when failed to load
- Check TypeScript errors during test command
- Allow \_\_additional on any identifier
- Add resource dependencies
- Convert MediaStream into reusable instance
- Allow defining reusable instances that must be obtained in a callback
- Inherit resources from imported tests
- Update ReadableStream custom test
- Add custom test for ReadableStream
- Add missing JavaScript features
- Fix some custom tests
- Fix custom test for api.BaseAudioContext.createPeriodicWave.constraints_disableNormalization_parameter
- Add custom tests for Iterator and AsyncIterator
- Update Error JS builtin test
- Make category argument required
- Add additional custom tests for JS builtins
- Allow a "custom" category in getCustomTest
- Mention what ECMAScript level to use in custom tests
- Add custom test for JS Error
- Remove Function.displayName
- Mention current issues with \_\_additional
- Use path.resolve for paths in environment variables
- Ensure highlight.js loads by setting "crossOrigin" to "true"
- Fix Symbol test generation
- Completely remove "code" property inside of custom/js.json
- Utilize getCustomTest() for JavaScript tests
- Integrate getCustomTestAPI code into getCustomTest
- Create "CATEGORIES" constant
- Fix Symbol test generation
- Use "@@" to determine if a member is a symbol (instead of "type")
- lib/config -&gt; lib/constants
- Add custom test for WebAssembly.Exception.stack (closes #265)
- Improve JavaScript custom tests a bit
- Fix broken GeneratorFunction constructor test
- Improve styling
- Update codecov ignores
- Add test for Generator builtin
- Add COOP+COEP headers to allow for testing gated features (JS atomics)
- Use getCustomTest() for CSS tests
- Restore checking for bad resources
- Resolve BCD and results dirs relative to project root
- Streamline resources lists in tests by de-duplicating resource data
- Fix generated tests for main API entry points
- Fix stupid TypeScript error
- Fix imports
- Add changelog page
- Add missing copyright comments
- Separate build.test.ts
- Rename custom-tests.ts to common.ts
- Give all unittest files a .test suffix
- Fix file references due to moved files
- Cleanup files
- Move files into subfolders for better organization
- Separate build.ts into multiple components (fixes #256)
- Fix broken tests
- Improve test code generation
- Remove getCustomResourcesAPI(); merge into getCustomTest()
- Separate DESIGN.md into other docs
- Document resource types
- Move custom tests documentation to its own doc
- Add alt. text to image resources
- Update comments
- Add more links to WebIDL spec
- Compile \_\_resources in getCustomTestData()
- Update documentation for custom tests
- Remove redundant pre-formatting
- Fix integration of getCustomTestData() into getCustomTestAPI()
- Move resources out of API folder (so they can be used by other categories)
- Rework getCustomSubtestsAPI()
- Use getCustomTestData() in getCustomTestAPI()
- Integrate generic getCustomTest() function into compileCustomTest()
- Implement generic getCustomTest[Data]() functions
- Results -&gt; reports where needed
- Implement better custom test support for JavaScript tests
- Add custom test for AsyncFunction
- Remove irrelevant custom IDL
- Update all dependencies
- Remove IE compatibility meta tags
- Add custom test for RTCStatsReport
- Remove custom IDL for Document.contains()

## Older Versions

- [v8.x](../changelog/v8.md)
- [v7.x](../changelog/v7.md)
- [v6.x](../changelog/v6.md)
- [v5.x](../changelog/v5.md)
- [v4.x](../changelog/v4.md)
- [v3.x](../changelog/v3.md)
- [v2.x](../changelog/v2.md)
- [v1.x](../changelog/v1.md)
