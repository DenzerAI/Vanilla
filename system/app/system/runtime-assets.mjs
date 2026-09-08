// Versioned model inputs for reproducible installations. Never store model bytes in Git.
export const speechAsset = {
  engine: 'piper-tts', version: '1.4.2', voice: 'de_DE-thorsten-high',
  repository: 'rhasspy/piper-voices', revision: 'v1.0.0', directory: 'de/de_DE/thorsten/high',
  requirements: 'requirements-speech.lock', installer: 'wrapper/scripts/setup-speech.mjs',
  files: {
    'de_DE-thorsten-high.onnx': '9df1c43c61149ef9b39e618e2b861fbe41e1fcea9390b2dac62e8761573ea4f1',
    'de_DE-thorsten-high.onnx.json': '6de734444e4c3f9e33b7ebe2746dbc19b71e85f613e79c65acf623200b99a76a',
    'MODEL_CARD': '35cd458c7691a668ec59c63eec3ccad5c7ce7ed36c9f946766616b266a038d57',
  },
};
