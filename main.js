const { app, BrowserWindow, ipcMain } = require('electron')
const { google } = require('googleapis');
const fs = require('fs');
const stream = require("stream"); // Added

var mianWindow = null, GlobalOAuth2Client = null;

function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    // and load the index.html of the app.
    win.loadFile('index.html')

    // Open the DevTools.
    win.webContents.openDevTools()


    return win
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(function () {

    mianWindow = createWindow();

    mianWindow.webContents.on('did-finish-load', () => {

        const initOAuth2Client = () => {
            try {
                const credentials = JSON.parse(fs.readFileSync('credentials.json'))
                const { client_secret, client_id, redirect_uris } = credentials.installed
                const OAuth2 = new google.auth.OAuth2(
                    client_id,
                    client_secret,
                    redirect_uris[0]
                );

                return OAuth2
                // return JSON.parse(fs.readFileSync('credentials1.json'))
            } catch (error) {
                return error
            }
        }

        GlobalOAuth2Client = initOAuth2Client();

    })

    ipcMain.on('setCredentials', (event, arg) => {

        GlobalOAuth2Client.setCredentials(JSON.parse(arg))
    })

    ipcMain.on('uploadFile', (event, localFile, filenmae, type, uploadId) => {

        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        if (uploadId == null)
            uploadId = 'root'

        let uploadBody = null
        let filesize = null

        // localfile is file path url
        // or localfile is buffer
        if (fs.existsSync(localFile)) {
            uploadBody = fs.createReadStream(localFile)
            filesize = fs.statSync(localFile).size
        } else {
            const base64Buf = new Buffer.from(localFile, "base64"); // base64 encoding
            const base64Stream = stream.PassThrough();
            base64Stream.end(base64Buf)
            uploadBody = base64Stream
        }

        drive.files.create(
            {
                resource: {
                    name: filenmae,
                    mimeType: type,
                    appProperties: {
                        app: "electronExample"
                    },
                    parents: [uploadId],
                },
                media: {
                    mimeType: type,
                    body: uploadBody
                }
            },
            {
                onUploadProgress: function (evt) {
                    if (filesize) {
                        const progress = (evt.bytesRead / filesize) * 100
                        // console.log(`${Math.round(progress)}% complete`)
                    }
                },
            }, function (err, file) {

                if (err) {
                    // Handle error
                    console.error(err);
                } else {
                    event.reply('uploadEnd', file.data.id)
                    // mianWindow.webContents.send('uploadCounter', true)
                    console.log('File Id: ', file.data.id);
                }
            });

    })

    ipcMain.on('downloadFile', (event, localFilePath, fileid, filename) => {

        let writeStream = fs.createWriteStream(localFilePath)
        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        async function getfile() {

            let res = await drive.files.get(
                {
                    fileId: fileid,
                    alt: 'media'
                },
                {
                    responseType: 'stream'
                }
            )
            let progress = 0;
            res.data.on('end', () => {
                console.log('Done downloading file.');
            }).on('error', err => {
                console.log(err)
                console.error('Error downloading file.');
            }).on('data', chunk => {
                progress += chunk.length;
                console.log(`Received ${progress} bytes of data.`);
            }).pipe(writeStream);

        }
        // getfile();

        // drive.files.get(
        //     {
        //         fileId: fileid,
        //         alt: 'media'
        //     },
        //     {
        //         responseType: 'stream'
        //     }
        // ).then((res) => {
        //     let progress = 0;
        //     console.log(res)
        //     res.data.on('end', () => {
        //         console.log('Done downloading file.');
        //     }).on('error', err => {
        //         console.log(err)
        //         console.error('Error downloading file.');
        //     }).on('data', chunk => {
        //         progress += chunk.length;
        //         console.log(`Received ${progress} bytes of data.`);
        //     }).pipe(writeStream);
        // })


    })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
