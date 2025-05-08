////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
//        _____ _                                                         //
//       |_   _| |__   ___                                                //
//         | | | '_ \ / _ \                                               //
//         | | | | | |  __/                                               //
//         |_| |_| |_|\___|          _  __           _                    //
//       / ___| _ __   __ _  ___ ___| |/ /___   __ _| | __ _              //
//       \___ \| '_ \ / _` |/ __/ _ \ ' // _ \ / _` | |/ _` |             //
//        ___) | |_) | (_| | (_|  __/ . \ (_) | (_| | | (_| |             //
//       |____/| .__/ \__,_|\___\___|_|\_\___/ \__,_|_|\__,_|             //
//             |_|                                                        //
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
//
// Telegram Event Script
// Version: V1.0.0
// Author: Luca Bartek, Marco Manenti
// Website: www.thespacekoala.com
//
// This script should be used via the WeightedBatchPreProcessing script of PixInsight.
// It cannot be run standalone.
//
// This work is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License.
// To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/
//
// You are free to:
// 1. Share — copy and redistribute the material in any medium or format
// 2. Adapt — remix, transform, and build upon the material
//
// Under the following terms:
// 1. Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
// 2. NonCommercial — You may not use the material for commercial purposes.
//
// @license CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
//
// COPYRIGHT © 2025 Luca Bartek, Marco Manenti. ALL RIGHTS RESERVED.
////////////////////////////////////////////////////////////////////////////

// Global Telegram API Configuration
const TELEGRAM_BOT_TOKEN = 'INSERT YOUR TOKEN HERE'; 
const TELEGRAM_CHAT_ID = 'INSERT YOUR CHAT ID HERE';

// Function to send a text message to Telegram
let sendMessageToTelegram = function (message) {
  const url =
    'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

  let args = [
    '-s',
    '-X',
    'POST',
    url,
    '-d',
    'chat_id=' + TELEGRAM_CHAT_ID,
    '-d',
    'text=' + message,
  ];

  ExternalProcess.execute('curl', args);
};

// Function to send a photo to Telegram
let sendPhotoToTelegram = function (processedImagePath, caption) {
  const url =
    'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendPhoto';

  let telegramCaption = caption ||'Your image is ready!';
  let args = [
    '-s',
    '-X',
    'POST',
    url,
    '-F',
    'chat_id=' + TELEGRAM_CHAT_ID,
    '-F',
    'photo=@' + processedImagePath,
    '-F',
    'caption=' + telegramCaption,
  ];

  ExternalProcess.execute('curl', args);
};

// Function to process, autostretch, and send the stacked image
let sendStackedImageToTelegram = function (imageToSend) {
  // Step 1: Open the stacked image
  let [window] = ImageWindow.open(imageToSend);
  if (!window) {
    console.criticalln('Failed to open the stacked image.');
    return;
  }

  // Step 2: Apply an autostretch after downsampling
  var Q = new IntegerResample();
  Q.zoomFactor = -2;
  Q.downsamplingMode = IntegerResample.prototype.Average;
  Q.noGUIMessages = true;
  Q.executeOn(window.mainView);

  let P = new PixelMath();
  P.expression =
    '//autostretch\n' +
    'c = min( max( 0, med( $T ) + C*1.4826*mdev( $T ) ), 1 );\n' +
    'mtf( mtf( B, med( $T ) - c ), max( 0, ($T - c)/~c ) )';
  P.useSingleExpression = true;
  P.symbols = 'C = -2.8,\nB = 0.25,\nc';
  P.createNewImage = false;
  P.executeOn(window.mainView);

  // Step 3: Save as JPEG
  let jpegPath = imageToSend.replace(/\.xisf$/i, '.jpg');
  window.saveAs(jpegPath, false, false, false, false, 'quality-80');

  // Step 4: Send the image via Telegram
  sendPhotoToTelegram(jpegPath);

  // Step 5: Close the image window
  window.forceClose();
};

// Main event script handling WBPP pipeline updates
if (env.event == 'start') {
  if (env.group) {
    let totalFramesCount = env.group.fileItems.length;
    let activeFramesCount = env.group.activeFrames().length;
    sendMessageToTelegram(
      env.name +
        ' starting: processing ' +
        activeFramesCount +
        '/' +
        totalFramesCount +
        ' active frames'
    );
  } else {
    sendMessageToTelegram(env.name);
  }
}

if (env.event == 'done') {
  if (env.status == OperationBlockStatus.DONE) {
    sendMessageToTelegram(env.name + ' successfully executed');
  } else if (env.status == OperationBlockStatus.FAILED) {
    sendMessageToTelegram(env.name + ' failed, ' + env.statusMessage);
  }
}

// Ensure `env` exists before accessing properties
if (typeof env !== 'undefined' && env.name) {
  if (
    (env.name == 'Integration' || env.name == 'FastIntegration') &&
    env.event == 'done'
  ) {
    sendStackedImageToTelegram(
      env.group.getMasterFileName(
        WBPPMasterType.MASTER_LIGHT,
        WBPPMasterVariant.REGULAR
      ),
      'Your integrated Master Light file is here!'
    );
  } else if (env.name == 'Drizzle Integration' && env.event == 'done') {
    sendStackedImageToTelegram(
      env.group.getMasterFileName(
        WBPPMasterType.MASTER_LIGHT,
        WBPPMasterVariant.DRIZZLE
      ),
      'Your integrated Drizzle file is here!'
    );
  } else if (env.name.indexOf('onPostProcessEnd') == 0 && env.event == 'done') {
    customFinalSteps = true;
  }
}

if (env.event == 'pipeline start') {
  sendMessageToTelegram('WBPP started.');
}

if (env.event === 'pipeline end') {
  sendMessageToTelegram('WBPP terminated.');
}
