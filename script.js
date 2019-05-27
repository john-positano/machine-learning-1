const classNames = [ 'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine' ];

async function showExamples(data) {
  // Create a container in the visor
  const surface = tfvis.visor().surface({ name: 'Input Data Examples', tab: 'Input Data'});  

  // Get the examples
  const examples = data.nextTestBatch(20);
  const numExamples = examples.xs.shape[0];
  
  // Create a canvas element to render each example
  for (let i = 0; i < numExamples; i++) {
    const imageTensor = tf.tidy(() => {
      // Reshape the image to 28x28 px
      return examples.xs
        .slice([i, 0], [1, examples.xs.shape[1]])
        .reshape([28, 28, 1]);
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    canvas.style = 'margin: 4px;';
    await tf.browser.toPixels(imageTensor, canvas);
    surface.drawArea.appendChild(canvas);

    imageTensor.dispose();
  }
}

async function run() {  
  const data = new MnistData();
  await data.load();
  await showExamples(data);

  const model = createModel();
  tfvis.show.modelSummary( { name: 'Model Architecture' }, model );

  await train( model, data );

  await showAccuracy( model, data );
  await showConfusion( model, data );
}

function createModel() {
  model = tf.sequential();

  const IMAGE_WIDTH = 28;
  const IMAGE_HEIGHT = 28;
  const IMAGE_CHANNELS = 1;

  const NUM_OUTPUT_CLASSES = 10;

  /* 1st Convolutional Layer */
  model.add(
    tf.layers.conv2d(
      {
        inputShape: [ IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS ],
        kernelSize: 5,
        filters: 8,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
      } 
    )
  );
  /* Rejoining */
  model.add( tf.layers.maxPooling2d( { poolSize: [ 2, 2 ], strides: [ 2, 2 ] } ) );

  /* 2nd Convolutional Layer */
  model.add(
    tf.layers.conv2d(
      {
        kernelSize: 5,
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
      }
    )
  );
  /* Rejoining again */
  model.add( tf.layers.maxPooling2d( { poolSize: [ 2, 2 ], strides: [ 2, 2 ] } ) );

  /* Vectorizing Tensors */
  model.add( tf.layers.flatten() );

  /* Final Classification */
  model.add(
    tf.layers.dense(
      {
        units: NUM_OUTPUT_CLASSES,
        kernelInitializer: 'varianceScaling',
        activation: 'softmax'
      }
    )
  );

  const optimizer = tf.train.adam();

  model.compile(
    {
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: [ 'accuracy' ]
    }
  );

  return model;
}

async function train ( model, data ) {
  const metrics = [ 'loss', 'val_loss', 'acc', 'val_acc' ];
  const container = {
    name: 'Model Training',
    styles: { height: '1000px' }
  };
  const fitCallbacks = tfvis.show.fitCallbacks( container, metrics );

  const BATCH_SIZE = 512;
  const TRAIN_DATA_SIZE = 5500;
  const TEST_DATA_SIZE = 1000;

  [ trainXs, trainYs ] = tf.tidy(
    function () {
      var d = data.nextTestBatch( TEST_DATA_SIZE );
      return [ d.xs.reshape( [ TEST_DATA_SIZE, 28, 28, 1 ] ), d.labels ];
    }
  );

  [ testXs, testYs ] = tf.tidy(
    function () {
      var d = data.nextTestBatch( TEST_DATA_SIZE );
      return [ d.xs.reshape( [ TEST_DATA_SIZE, 28, 28, 1 ] ), d.labels ];
    }
  );

  return model.fit(
    trainXs,
    trainYs,
    {
      batchSize: BATCH_SIZE,
      validationData: [ testXs, testYs ],
      epochs: 10,
      shuffle: true,
      callbacks: fitCallbacks
    }
  );
}

function doPrediction ( model, data, testDataSize = 500 ) {
  const IMAGE_WIDTH = 28;
  const IMAGE_HEIGHT = 28;

  var testData = data.nextTestBatch( testDataSize );
  var testxs = testData.xs.reshape( [ testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, 1 ] );
  var labels = testData.labels.argMax( [ -1 ] );
  var preds = model.predict( testxs ).argMax( [ -1 ] );

  testxs.dispose();

  return [ preds, labels ];
}

async function showAccuracy ( model, data ) {
  [ preds, labels ] = doPrediction( model, data );
  var classAccuracy = await tfvis.metrics.perClassAccuracy( labels, preds );
  var container = { name: 'Accuracy', tab: 'Evaluation' };
  tfvis.show.perClassAccuracy( container, classAccuracy, classNames );

  labels.dispose();
}

async function showConfusion ( model, data ) {
  [ preds, labels ] = doPrediction( model, data );
  var confusionMatrix = await tfvis.metrics.confusionMatrix( labels, preds );
  var container = { name: 'Confusion Matrix ', tab: 'Evaluation' };
  tfvis.render.confusionMatrix( container, { values: confusionMatrix }, classNames );

  labels.dispose();
}