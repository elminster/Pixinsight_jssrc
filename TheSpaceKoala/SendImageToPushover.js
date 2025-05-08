
// ==================================================================================
// SendImageToPushover.js - A PixInsight script to process an image and send it to Pushover
//
// Copyright (c) 2025 Luca Bartek
// Notification Event Script
// Version: V1.0.0
// Author: Luca Bartek, [Modified for Pushover by Duncan Reed]
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
#feature-id SendImageToPushover : TheSpaceKoala > SendImageToPushover
#feature-icon  pushover.svg
#feature-info  Use the notification system provided by pushover.net 

#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/UndoFlag.jsh>
#include       "KoalaUtils.js"

#define TITLE "Send Image To Pushover"
#define VERSION "V1.0.0" // 20250507

// Constants
var MAX_SIZE_MB = 5;
var MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024; // 5 MB in bytes

this.PUSHOVER_SETTINGS_KEY_BASE = 'SendImagePushover/';

function loadPushoverSettings() {
    var appToken = Settings.read(
        PUSHOVER_SETTINGS_KEY_BASE + 'appToken',
        DataType_UCString
    );
    var userKEY = Settings.read(
        PUSHOVER_SETTINGS_KEY_BASE + 'userKEY',
        DataType_UCString
    );
    if (userKEY == -2147483648) {
        userKEY = Number.NaN;
    }
    var doStretch = Settings.read(
        PUSHOVER_SETTINGS_KEY_BASE + 'doStretch',
        DataType_Boolean
    );
    var linked = Settings.read(
        PUSHOVER_SETTINGS_KEY_BASE + 'linked',
        DataType_Boolean
    );
    var message =
        Settings.read(PUSHOVER_SETTINGS_KEY_BASE + 'message', DataType_UCString) ||
        '';

    return {
        appToken: appToken,
        userKEY: userKEY,
        doStretch: doStretch,
        linked: linked,
        message: message,
    };
}

function resetPushoverSettings() {
    Settings.remove(PUSHOVER_SETTINGS_KEY_BASE + 'appToken');
    Settings.remove(PUSHOVER_SETTINGS_KEY_BASE + 'userKEY');
    Settings.remove(PUSHOVER_SETTINGS_KEY_BASE + 'doStretch');
    Settings.remove(PUSHOVER_SETTINGS_KEY_BASE + 'linked');
    Settings.remove(PUSHOVER_SETTINGS_KEY_BASE + 'message');
}

function savePushoverSettings(
    appToken,
    userKEY,
    doStretch,
    linked,
    message
) {
    Settings.write(
        PUSHOVER_SETTINGS_KEY_BASE + 'appToken',
        DataType_UCString,
        appToken
    );
    Settings.write(PUSHOVER_SETTINGS_KEY_BASE + 'userKEY', DataType_UCString, userKEY.toString());
    Settings.write(
        PUSHOVER_SETTINGS_KEY_BASE + 'doStretch',
        DataType_Boolean,
        doStretch
    );
    Settings.write(
        PUSHOVER_SETTINGS_KEY_BASE + 'linked',
        DataType_Boolean,
        linked
    );
    Settings.write(
        PUSHOVER_SETTINGS_KEY_BASE + 'message',
        DataType_UCString,
        message
    );
}

function validateInputs(token, userKEY) {
    if (!token) {
        raiseError('Pushover APP Token is mandatory.');
        return false;
    }
    if (!userKEY) {
        raiseError('User Key is mandatory.');
        return false;
    }
    return true;
}

// Helper function to safely remove a file if it exists
function safeRemoveFile(filePath) {
    try {
        if (File.exists(filePath)) {
            File.remove(filePath);
            return true;
        }
    } catch (e) {
        console.noteln("Warning: Could not remove file " + filePath + ": " + e.toString());
    }
    return false;
}

// Helper function to safely copy a file with fallback to move
function safeCopyFile(sourcePath, destPath) {
    try {
        // Remove destination if it exists
        safeRemoveFile(destPath);
        
        // Try to copy
        File.copyFile(sourcePath, destPath);
        return true;
    } catch (e) {
        //console.noteln("Warning: Could not copy file: " + e.toString());
        
        // Try to move as fallback
        try {
            File.move(sourcePath, destPath);
            return true;
        } catch (e2) {
            console.noteln("Error: Could not copy or move file: " + e2.toString());
        }
    }
    return false;
}

// Function to get a unique temporary file path
function getUniqueTempPath(basePath) {
    let timestamp = new Date().getTime();
    let uniquePath = basePath + "." + timestamp + ".temp.jpg";
    
    // Make sure it doesn't exist
    while (File.exists(uniquePath)) {
        timestamp++;
        uniquePath = basePath + "." + timestamp + ".temp.jpg";
    }
    
    return uniquePath;
}


// Function to check and reduce file size if needed
function ensureFileSizeUnderLimit(imagePath) {
    // Debug information
    console.noteln("Processing image: " + imagePath);
    
    // Use FileInfo to check if file exists
    try {
        let fileInfo = new FileInfo(imagePath);
        if (!fileInfo.exists) {
            console.noteln("File does not exist according to FileInfo: " + imagePath);
            
            // Try to list directory contents to see what's available
            let directory = File.extractDrive(imagePath) + File.extractDirectory(imagePath);
            console.noteln("Looking in directory: " + directory);
            
            let dirInfo = new FileInfo(directory);
            if (dirInfo.isDirectory) {
                let files = dirInfo.files();
                console.noteln("Files in directory:");
                for (let i = 0; i < files.length; ++i) {
                    console.noteln(" - " + files[i]);
                }
            }
            
            printError("File not found: " + imagePath);
            return false;
        }
        
        // File exists, get its size
        let fileSize = fileInfo.size;
        console.noteln("Image size: " + (fileSize / (1024 * 1024)).toFixed(2) + " MB");
        
        // If file is already under the size limit, we're done
        if (fileSize <= MAX_SIZE_BYTES) {
            console.noteln("Image is already under " + MAX_SIZE_MB + " MB, no reduction needed");
            return true;
        }
        
        // File is too large, need to reduce its size
        console.noteln("Image exceeds " + MAX_SIZE_MB + " MB, reducing size...");
        
        // Create a unique temporary file path for processing
        let tempPath = getUniqueTempPath(imagePath);
        console.noteln("Using temporary file: " + tempPath);
        
        // Open the image
        let jpegImage = null;
        try {
            console.noteln("Opening image file...");
            let windows = ImageWindow.open(imagePath);
            
            if (!windows || windows.length === 0) {
                printError("Failed to open image: No windows returned");
                return false;
            }
            
            jpegImage = windows[0];
            
            if (jpegImage.isNull) {
                printError("Failed to open image for size reduction: Null window");
                return false;
            }
            
            console.noteln("Image opened successfully. Dimensions: " + 
                          jpegImage.mainView.image.width + "x" + 
                          jpegImage.mainView.image.height);
            
            let reduced = false;
            


            // Apply a resize process to reduce dimensions
            let resizeFactor = 0.8; // Start with 80% of original size

            while (resizeFactor >= 0.3 && !reduced) { // Don't go below 30% of original size
                // Use IntegerResample which is more reliable for downsampling
                let resample = new IntegerResample;
                // Calculate zoom factor based on resize factor (negative for downsampling)
                let zoomFactor = -Math.max(2, Math.round(1 / resizeFactor));
                resample.zoomFactor = zoomFactor;
                resample.downsamplingMode = IntegerResample.prototype.Average; // Use average for downsampling
                resample.noGUIMessages = true;

                console.noteln("Resizing with zoom factor: " + zoomFactor);

                // Execute the process
                resample.executeOn(jpegImage.mainView);

                // Save with moderate quality to temp file
                // Make sure we use a fresh temp path each time
                safeRemoveFile(tempPath);
                jpegImage.saveAs(tempPath, false, false, false, false, "quality-80");

                // Check new file size
                let tempFileInfo = new FileInfo(tempPath);
                if (tempFileInfo.exists) {
                    fileSize = tempFileInfo.size;

                    console.noteln("New file size after resize: " + (fileSize / (1024 * 1024)).toFixed(2) + " MB");

                    if (fileSize <= MAX_SIZE_BYTES) {
                        console.noteln("Successfully reduced image to " + (fileSize / (1024 * 1024)).toFixed(2) + " MB with resize factor " + resizeFactor.toFixed(2));
                        reduced = true;

                        // Copy temp file to original path
                        if (safeCopyFile(tempPath, imagePath)) {
                            console.noteln("Successfully copied resized image to original path");
                        }
                    } else {
                        // Reduce size further for next attempt
                        resizeFactor -= 0.1;
                        // Remove temp file before next attempt
                        safeRemoveFile(tempPath);
                    }
                } else {
                    console.noteln("Temp file not created properly during resize");
                    resizeFactor -= 0.1;
                }
            }

            // Clean up temp file if it exists
            safeRemoveFile(tempPath);
            
            // Close the image window
            jpegImage.forceClose();
            
            if (!reduced) {
                printWarning("Could not reduce image below " + MAX_SIZE_MB + " MB. Attempting to send anyway.");
            }
            
            return true;
        }
        catch (error) {
            printError("Error processing image: " + error.toString());
            if (jpegImage && !jpegImage.isNull) {
                jpegImage.forceClose();
            }
            
            // Clean up temp file if it exists
            safeRemoveFile(tempPath);
            return false;
        }
    } catch (error) {
        printError("Error checking file: " + error.toString());
        return false;
    }
}

function sendPhotoToPushover(imagePath, appToken, userKEY, message) {

    // Confirm file is under 5MB
    if (!ensureFileSizeUnderLimit(imagePath)) {
        printError("Failed to process image for sending");
        return;
    }
    
    console.noteln("Sending file to Pushover: " + imagePath);
    
    const url = 'https://api.pushover.net/1/messages.json';

    let args = [
        '--form-string',
        'token=' + appToken,
        '--form-string',
        'user=' + userKEY,
        '--form-string',
        'priority=-1',
        '--form-string',
        'title=PixInsight Picture',
        '-F',
        'attachment=@' + imagePath,
        url,
    ];

    if (message) {
        args[args.length] = '--form-string';
        args[args.length] = 'message=' + message;
    }

    // Debug the curl command
    //console.noteln("Executing curl with arguments:");
    //for (let i = 0; i < args.length; i++) {
    //    console.noteln("  " + i + ": " + args[i]);
    //}

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
    doStretch,
    linked,
    message
) {
    // Duplicate the image window
    var duplicateWindow = duplicateImageWindow(imageWindow, 'foobar23204');

    if (doStretch) {
        applyAutoStretch(
            duplicateWindow.mainView,
            linked || duplicateWindow.mainView.image.isGrayscale
        );
    }

    var width = duplicateWindow.mainView.image.width;
    var height = duplicateWindow.mainView.image.height;
    var resampleFactor = 1;

    // Loop until width + height is below 10,000
    while (width / resampleFactor + height / resampleFactor > 10000) {
        resampleFactor++;
    }
    if (resampleFactor > 1) {
        downsampleImage(duplicateWindow.mainView, -resampleFactor);
    }

    // Export image as JPEG
    var jpegPath = saveImageAsJpeg(duplicateWindow, null, 'PushoverProcessed');
    
    // Close the duplicate window
    duplicateWindow.forceClose();

    console.noteln('jpegPath ' + jpegPath);

    // Send the image via Pushover
    sendPhotoToPushover(jpegPath, appToken, userKEY, message);
}

function PushoverDialog() {
    this.__base__ = Dialog;
    this.__base__();

    this.windowTitle = 'Send Image to Pushover';
    // Load saved settings
    let savedConfig = loadPushoverSettings();
    // Pushover App Token Input
    this.tokenLabel = new Label(this);
    this.tokenLabel.text = 'Pushover App Token:';
    this.tokenLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.tokenInput = new Edit(this);
    this.tokenInput.text = savedConfig.appToken || '';
    this.tokenInput.setFixedWidth(350);

    let tokenSizer = new HorizontalSizer();
    tokenSizer.spacing = 4;
    tokenSizer.add(this.tokenLabel);
    tokenSizer.add(this.tokenInput, 100);

    // User KeyInput
    this.userKEYLabel = new Label(this);
    this.userKEYLabel.text = 'User Key:';
    this.userKEYLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.userKEYInput = new Edit(this);
    this.userKEYInput.text = savedConfig.userKEY|| '';
    this.userKEYInput.setFixedWidth(350);

    let userKEYSizer = new HorizontalSizer();
    userKEYSizer.spacing = 4;
    userKEYSizer.add(this.userKEYLabel);
    userKEYSizer.add(this.userKEYInput, 100);

    // === Message Input ===
    this.messageLabel = new Label(this);
    this.messageLabel.text = 'Message:';
    this.messageLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.messageInput = new Edit(this);
    this.messageInput.text = savedConfig.message || ''; // Load saved message
    this.messageInput.setFixedWidth(350);

    var messageSizer = new HorizontalSizer();
    messageSizer.spacing = 4;
    messageSizer.add(this.messageLabel);
    messageSizer.add(this.messageInput, 100);

    // === Auto-Stretch Checkbox ===
    this.autoStretchCheckbox = new CheckBox(this);
    this.autoStretchCheckbox.text = 'Auto-Stretch';
    this.autoStretchCheckbox.checked = savedConfig.doStretch || false;

    var autoStretchSizer = new HorizontalSizer();
    autoStretchSizer.spacing = 4;
    autoStretchSizer.addSpacing(20);
    autoStretchSizer.add(this.autoStretchCheckbox);
    autoStretchSizer.addStretch();

    // === Linked Checkbox (Only Active When Auto-Stretch is Enabled) ===
    this.linkedCheckbox = new CheckBox(this);
    this.linkedCheckbox.text = 'Linked Channels';
    this.linkedCheckbox.checked = savedConfig.linked || false;
    this.linkedCheckbox.enabled = this.autoStretchCheckbox.checked; // Initially enabled based on auto-stretch

    var linkedSizer = new HorizontalSizer();
    linkedSizer.spacing = 4;
    linkedSizer.addSpacing(20);
    linkedSizer.add(this.linkedCheckbox);
    linkedSizer.addStretch();

    // === Toggle Linked Checkbox Based on Auto-Stretch ===
    var self = this;
    this.autoStretchCheckbox.onCheck = function (checked) {
        self.linkedCheckbox.enabled = checked;
    };

    // === "New Instance" Button (Triangle Icon) ===
    this.newInstanceButton = new ToolButton(this);
    this.newInstanceButton.icon = this.scaledResource(
        ':/process-interface/new-instance.png'
    );
    this.newInstanceButton.setScaledFixedSize(24, 24);
    this.newInstanceButton.toolTip = 'New Instance';
    var self = this;
    this.newInstanceButton.onMousePress = function () {
        var P = new Object();

        // Save all parameters into P
        P.appToken = self.tokenInput.text.trim();
        P.userKEY = self.userKEYInput.text.trim();
        P.doStretch = self.autoStretchCheckbox.checked;
        P.linked = self.linkedCheckbox.checked;
        P.message = self.messageInput.text.trim();

        // Store parameters in the instance
        Parameters.clear();
        for (var key in P) {
            if (P[key] !== undefined) {
                Parameters.set(key, P[key]);
            }
        }
        self.newInstance();
    };

    // === "Documentation Browser" Button (Docm Icon) ===

    this.browseDocumentationButton = new ToolButton(this);
    this.browseDocumentationButton.icon = this.scaledResource(":/process-interface/browse-documentation.png");
    this.browseDocumentationButton.setScaledFixedSize(24, 24);
    this.browseDocumentationButton.toolTip =
        "<p>Opens a browser to view the script's documentation.</p>";
    this.browseDocumentationButton.onClick = function () {
        Dialog.browseScriptDocumentation("SendImageToPushover");
    }


    // Run Button
    this.runButton = new PushButton(this);
    this.runButton.text = 'Run';
    this.runButton.icon = this.scaledResource(':/icons/power.png');

    this.runButton.onClick = () => {
        var token = this.tokenInput.text.trim();
        var userKEY = this.userKEYInput.text.trim();
        var doStretch = this.autoStretchCheckbox.checked;
        var linked = this.linkedCheckbox.checked;
        var message = this.messageInput.text.trim();
        if (!validateInputs(token, userKEY)) {
            return; // Exit if validation fails
        }

        // Execute the image processing and sending function
        if (!ImageWindow.activeWindow.isNull) {
            processAndSendImageToPushover(
                ImageWindow.activeWindow,
                token,
                userKEY,
                doStretch,
                linked,
                message
            );
            savePushoverSettings(token, userKEY, doStretch, linked, message); // Save settings
            this.ok(); // Close the log
        } else {
            raiseError('No active image window found');
        }
    };

    // Cancel Button
    this.cancelButton = new PushButton(this);
    this.cancelButton.text = 'Cancel';
    this.cancelButton.icon = this.scaledResource(':/icons/close.png');
    this.cancelButton.onClick = function () {
        this.dialog.cancel();
    };

    // Reset Button
    this.resetButton = new ToolButton(this);
    this.resetButton.icon = this.scaledResource(':/process-interface/reset.png');
    this.resetButton.setScaledFixedSize(24, 24);
    this.resetButton.toolTip = '<p>Resets all settings to their defaults.</p>';
    this.resetButton.onClick = () => {
        resetPushoverSettings();
        this.tokenInput.text = '';
        this.userKEYInput.text = '';
        this.autoStretchCheckbox.checked = false;
        this.linkedCheckbox.checked = false;
        this.messageInput.text = '';
    };

    // Button Layout
    var buttonSizer = new HorizontalSizer();
    buttonSizer.spacing = 8;
    buttonSizer.add(this.newInstanceButton);
    buttonSizer.add(this.browseDocumentationButton);
    buttonSizer.addStretch();
    buttonSizer.add(this.runButton);
    buttonSizer.add(this.cancelButton);
    buttonSizer.add(this.resetButton);

    // Main Layout
    this.sizer = new VerticalSizer();
    this.sizer.margin = 10;
    this.sizer.spacing = 6;
    this.sizer.add(tokenSizer);
    this.sizer.add(userKEYSizer);
    this.sizer.add(messageSizer);
    this.sizer.add(autoStretchSizer);
    this.sizer.add(linkedSizer);
    this.sizer.addSpacing(8);
    this.sizer.add(buttonSizer);

    this.adjustToContents();
}

function main() {
    printTheSpaceKoalaBanner();

    // If the process was dragged onto an image, execute immediately without opening the GUI
    if (Parameters.isViewTarget) {
        let targetWindow = Parameters.targetView.window;

        if (!targetWindow.isNull) {
            var token = Parameters.get('appToken');
            var userKEY = Parameters.get('userKEY');
            var doStretch = Parameters.get('doStretch');
            var linked = Parameters.get('linked');
            var message = Parameters.get('message');

            if (!validateInputs(token, userKEY)) {
                return; // Exit if validation fails
            }

            processAndSendImageToPushover(
                targetWindow,
                token,
                userKEY,
                doStretch,
                linked,
                message
            );
        } else {
            printError('No valid target image found.');
        }
        return;
    }

    // Otherwise: Open the GUI
    let dialog = new PushoverDialog();
    if (!dialog.execute()) {
        printInfo('User canceled the script.');
        return;
    }
}

// Extend Dialog prototype
PushoverDialog.prototype = new Dialog();

main();