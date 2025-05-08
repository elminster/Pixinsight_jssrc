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
// Pushover Event Script
// Version: V1.0.0
//
// Based on Telegram Event Script
// Author: Luca Bartek, Roberto Sartori
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
// COPYRIGHT © 2025 Luca Bartek, Roberto Sartori. ALL RIGHTS RESERVED.
////////////////////////////////////////////////////////////////////////////

// Global Pushover API Configuration
const PUSHOVER_APP_TOKEN = 'INSERT YOUR TOKEN HERE';
const PUSHOVER_USER_KEY = 'INSERT YOUR TOKEN HERE';

// Function to send a text message to Pushover
let sendMessageToPushover = function (title, message, msgpriority) {

    if (typeof msgpriority === 'undefined') { msgpriority = '-1'; }

    //console.writeln("[SCRIPT LOG] Priority: " + msgpriority);

    const url =
        'https://api.pushover.net/1/messages.json';

    let args = [
        '--form-string',
        'token=' + PUSHOVER_APP_TOKEN,
        '--form-string',
        'user=' + PUSHOVER_USER_KEY,
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

    ExternalProcess.execute('curl', args);
};

// Function to check file size in MB
let getFileSizeInMB = function (filePath) {
    let file = new File(filePath);
    if (!file.openForReading()) {
        console.criticalln('Failed to open file for size check: ' + filePath);
        return -1;
    }

    let sizeInBytes = file.size;
    file.close();

    return sizeInBytes / (1024 * 1024); // Convert bytes to MB
};

// Function to reduce image size below 5MB
let reduceImageSizeBelow5MB = function (imagePath) {
    let fileSize = getFileSizeInMB(imagePath);
    console.writeln("[SCRIPT LOG] Original file size: " + fileSize.toFixed(2) + " MB");

    if (fileSize <= 5) {
        console.writeln("[SCRIPT LOG] Image already below 5MB");
        return imagePath;
    }

    // Get file extension
    let extension = File.extractExtension(imagePath).toLowerCase();
    if (extension !== "jpg" && extension !== "jpeg") {
        // If not a JPEG, convert to JPEG first
        let jpegPath = imagePath.replace(/\.[^.]+$/, '.jpg');
        let [window] = ImageWindow.open(imagePath);
        if (!window) {
            console.criticalln('Failed to open image for conversion.');
            return imagePath;
        }

        window.saveAs(jpegPath, false, false, false, false, 'quality-85');
        window.forceClose();
        imagePath = jpegPath;
    }

    // Try progressively lower quality settings
    let qualityLevels = [80, 70, 60, 50, 40, 30];
    for (let i = 0; i < qualityLevels.length; i++) {
        let quality = qualityLevels[i];
        let resizedPath = imagePath.replace(/\.jpg$/i, '_q' + quality + '.jpg');

        let [window] = ImageWindow.open(imagePath);
        if (!window) {
            console.criticalln('Failed to open image for resizing.');
            return imagePath;
        }

        // If we're at lower quality levels, also reduce dimensions
        if (quality < 60) {
            let resampleFactor = quality < 50 ? 0.5 : 0.75;
            let R = new Resample();
            R.xSize = Math.floor(window.mainView.image.width * resampleFactor);
            R.ySize = Math.floor(window.mainView.image.height * resampleFactor);
            R.noGUIMessages = true;
            R.executeOn(window.mainView);
        }

        window.saveAs(resizedPath, false, false, false, false, 'quality-' + quality);
        window.forceClose();

        fileSize = getFileSizeInMB(resizedPath);
        console.writeln("[SCRIPT LOG] Reduced file size (quality " + quality + "): " + fileSize.toFixed(2) + " MB");

        if (fileSize <= 5) {
            console.writeln("[SCRIPT LOG] Successfully reduced image below 5MB");
            return resizedPath;
        }

        // Clean up this attempt if it didn't work
        let attemptFile = new File(resizedPath);
        if (attemptFile.exists) {
            attemptFile.remove();
        }
    }

    // If we get here, we need more drastic measures - create a very small version
    let lastResortPath = imagePath.replace(/\.jpg$/i, '_small.jpg');
    let [window] = ImageWindow.open(imagePath);
    if (!window) {
        console.criticalln('Failed to open image for final resize.');
        return imagePath;
    }

    // Drastically reduce size
    let R = new Resample();
    R.xSize = Math.min(800, window.mainView.image.width);
    R.ySize = Math.round(window.mainView.image.height * (R.xSize / window.mainView.image.width));
    R.noGUIMessages = true;
    R.executeOn(window.mainView);

    window.saveAs(lastResortPath, false, false, false, false, 'quality-30');
    window.forceClose();

    console.writeln("[SCRIPT LOG] Created small version of image");
    return lastResortPath;
};

// Function to send a photo to Pushover
let sendPhotoToPushover = function (processedImagePath, caption, msgpriority) {
    if (typeof msgpriority === 'undefined') { msgpriority = '-1'; }

    let pushoverCaption = 'Your image is ready!';

    const url =
        'https://api.pushover.net/1/messages.json';

    let args = [
        '--form-string',
        'token=' + PUSHOVER_APP_TOKEN,
        '--form-string',
        'user=' + PUSHOVER_USER_KEY,
        '--form-string',
        'message=' + caption,
        '--form-string',
        'priority=' + msgpriority,
        '--form-string',
        'title=' + pushoverCaption,
        '-F',
        'attachment=@' + processedImagePath,
        url,
    ];

    ExternalProcess.execute('curl', args);


};

// Function to process, autostretch, and send the stacked image
let sendStackedImageToPushover = function (imageToSend, message) {
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

    // Step 4: Send the image via Pushover
    sendPhotoToPushover(jpegPath, message);

    // Step 5: Close the image window
    window.forceClose();
};

// Main event script handling WBPP pipeline updates
if (env.event == 'start') {
    if (env.group) {
        let totalFramesCount = env.group.fileItems.length;
        let activeFramesCount = env.group.activeFrames().length;
        sendMessageToPushover(
            'Start',
            env.name +
            ' starting: processing ' +
            activeFramesCount +
            '/' +
            totalFramesCount +
            ' active frames'
        );
    } else {
        sendMessageToPushover('Start', env.name);
    }
}

if (env.event == 'done') {
    if (env.status == OperationBlockStatus.DONE) {
        sendMessageToPushover('Done', env.name + ' successfully executed');
    } else if (env.status == OperationBlockStatus.FAILED) {
        sendMessageToPushover('Failed', env.name + ' failed, ' + env.statusMessage, '2');
    }
}

// Ensure `env` exists before accessing properties
if (typeof env !== 'undefined' && env.name) {
    if (
        (env.name == 'Integration' || env.name == 'FastIntegration') &&
        env.event == 'done'
    ) {
        sendStackedImageToPushover(
            env.group.getMasterFileName(
                WBPPMasterType.MASTER_LIGHT,
                WBPPMasterVariant.REGULAR
            ),
            'Your integrated Master Light file is here!'
        );
        //sendMessageToPushover('Integration', env.name + ' You should have got an Integration photo!');
    } else if (env.name == 'Drizzle Integration' && env.event == 'done') {
        sendStackedImageToPushover(
            env.group.getMasterFileName(
                WBPPMasterType.MASTER_LIGHT,
                WBPPMasterVariant.DRIZZLE
            ),
            'Your integrated Drizzle file is here!'
        );
        //sendMessageToPushover('Drizzle', env.name + ' You should have got a Drizzle file is here!');
    } else if (env.name.indexOf('onPostProcessEnd') == 0 && env.event == 'done') {
        customFinalSteps = true;
    }
}

if (env.event == 'pipeline start') {
    sendMessageToPushover('Pipe Start', 'WBPP started.');
}

if (env.event === 'pipeline end') {
    sendMessageToPushover('Pipe End', 'WBPP Finished.', '1');
}
