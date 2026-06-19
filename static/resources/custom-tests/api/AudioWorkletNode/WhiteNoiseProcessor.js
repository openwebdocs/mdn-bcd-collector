/**
 * Process the audio inputs and generate white noise.
 * @param {Array} inputs - The audio inputs.
 * @param {Array} outputs - The audio outputs.
 * @returns {boolean} - Whether the process was successful.
 */
class WhiteNoiseProcessor extends AudioWorkletProcessor {
  /**
   * Process the audio inputs and generate white noise.
   * @param {Array} inputs - The audio inputs.
   * @param {Array} outputs - The audio outputs.
   * @returns {boolean} - Whether the process was successful.
   */
  process(inputs, outputs) {
    const output = outputs[0];
    output.forEach((channel) => {
      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.random() * 2 - 1;
      }
    });
    return true;
  }
}

registerProcessor("white-noise-processor", WhiteNoiseProcessor);
