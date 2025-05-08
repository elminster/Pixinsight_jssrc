// ==================================================================================
// SendMessageToPushover.js
//
// Copyright (c) 2025 Luca Bartek
// Notification Event Script
// Version: V1.0.0
// Author: Luca Bartek, Duncan Reed (Pushover version)
// Website: www.thespacekoala.com
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// ==================================================================================

//#include "KoalaUtils.js"

// Function to send a Pushover message
function sendMessageToPushover(appToken, userKEY, title, message, msgpriority) {

    if (typeof msgpriority === 'undefined') { msgpriority = '-1'; }

    var url =
        'https://api.pushover.net/1/messages.json';

    var args = [
        '--form-string',
        'token=' + appToken,
        '--form-string',
        'user=' + userKEY,
        '--form-string',
        'message=' + message,
        '--form-string',
        'priority=' + msgpriority,
        '--form-string',
        'ttl=3600',
        '--form-string',
        'title=' + title,
        url,
    ];

    var p = new ExternalProcess();
    ExternalProcess.execute('curl', args);
};




// Function to send a photo to Pushover
function sendImageToPushover(processedImagePath, appToken, userKEY, message, msgpriority) {
    if (typeof msgpriority === 'undefined') { msgpriority = '-1'; }

    let pushoverCaption = 'Your image is ready!';

    const url =
        'https://api.pushover.net/1/messages.json';

    let args = [
        '--form-string',
        'token=' + appToken,
        '--form-string',
        'user=' + userKEY,
        '--form-string',
        'priority=' + msgpriority,
        '--form-string',
        'title=' + pushoverCaption,
        '-F',
        'attachment=@' + processedImagePath,
        url,
    ];

    if (message) {
        args[args.length] = '--form-string';
        args[args.length] = 'message=' + message;
    }

    // Execute curl command
    let exitCode = ExternalProcess.execute('curl', args);

    // Check if the request was successful
    if (exitCode !== 0) {
        printError('Failed to send photo. Curl exit code: ' + exitCode);
    } else {
        printInfo('Photo successfully sent to Pushover!');
    }
}

function processAndSendImageToPushover(
  imageWindow,
 appToken,
  userKEY,
  message,
  doStretch,
  linked
) {
  // Duplicate the image window
  var duplicateWindow = duplicateImageWindow(imageWindow, 'PushoverProcessed');

  // Apply auto-stretch if the flag is set
  if (doStretch == true) {
    applyAutoStretch(duplicateWindow.mainView, linked || duplicateWindow.mainView.image.isGrayscale);
  }

  var width = duplicateWindow.mainView.image.width;
  var height = duplicateWindow.mainView.image.height;
  var resampleFactor = 1;

  // Loop to resample the image if necessary
  while (width / resampleFactor + height / resampleFactor > 10000) {
    resampleFactor++;
  }

  // Downsample if necessary
  if (resampleFactor > 1) {
    downsampleImage(duplicateWindow.mainView, -resampleFactor);
  }

  // Save the image as JPEG
  var jpegPath = saveImageAsJpeg(duplicateWindow, null, 'PushoverProcessed');
  console.noteln('JPEG saved at: ' + jpegPath);

  // Send the image via Pushover
  sendImageToPushover(jpegPath, appToken, userKEY, message);

  // Close the duplicate window after processing
  duplicateWindow.forceClose();
}
