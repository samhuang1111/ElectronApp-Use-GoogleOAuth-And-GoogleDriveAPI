const { google } = require('googleapis');
const fs = require('fs')


// const fetch = require('node-fetch')

const { ipcRenderer } = require('electron');

const { app, BrowserWindow } = require('electron').remote

const mime = require('mime-types')
const stream = require('stream');
const { setTimeout } = require('timers');
const { resolve } = require('path');

window.addEventListener('load', onload)

function onload() {

    var LogintBtn = document.getElementById("Login")
    var StatusText = document.getElementById("Status")
    var uploadPathText = document.getElementById("uploadPath")
    var createFolderBtn = document.getElementById("createFolder")

    var listFolderBtn = document.getElementById("listFolder")
    var uplodaFileBtn = document.getElementById("uplodaFile")

    var listFilesBtn = document.getElementById('listFiles')

    var downloadFileBtn = document.getElementById('downloadFile')

    const timer = 3000000;

    const SCOPES = ['https://www.googleapis.com/auth/drive'];
    const TOKEN_PATH = 'token.json';

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

    var GlobalOAuth2Client = initOAuth2Client();
    var myCreateFolderID = null;

    // 入口
    fs.readFile(TOKEN_PATH, (err, content) => {
        // frist login
        if (err) {

            StatusText.innerText = "Login Status：not sign in"
            LogintBtn.onclick = Login

        } else {

            StatusText.innerText = "Login Status：is sign in"

            // 打開應用後初始化
            // Initialize()內的條件是
            // 剩餘時間小於50分鐘就會自動刷新
            Initialize(content)

            // 50分鐘自動刷新
            setInterval(() => {
                Initialize(content)
            }, timer);

        }
    })

    listFolderBtn.onclick = listFolder;
    function listFolder() {

        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        async function main() {

            let appProperties = "and appProperties has { key='app' and value='electronExample' }"

            drive.files.list({

                pageSize: 100,
                q: "trashed = false and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents "

            }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
                const folders = res.data.files;

                if (folders.length) {

                    console.log('folders:');
                    console.log(folders)

                } else {

                    console.log('No files found.');

                }
            });

        }

        main().catch(console.error)

        // main().catch(console.error)

    }

    listFilesBtn.onclick = listFiles;
    function listFiles() {

        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        async function main() {

            let appProperties = "and appProperties has { key='app' and value='electronExample' }"
            let id = 'root'

            return new Promise((resolve, reject) => {

                drive.files.list(
                    {
                        pageSize: 100,
                        q: "trashed = false and '" + id + "' in parents and mimeType != 'application/vnd.google-apps.folder' ",
                        fields: "nextPageToken,files(id,name,originalFilename,thumbnailLink)"
                    },
                    function (err, res) {

                        if (err) reject('The API returned an error: ' + err);

                        const files = res.data.files;

                        if (files.length) {
                            console.log('files:');
                            // console.log(files)
                            resolve(files)
                        } else {
                            console.log('No files found.');
                            resolve([])
                        }
                    }
                )

            })

        }

        return new Promise((resolve, reject) => {

            main().then((res) => {

                console.log(res)
                resolve(res)

            }).catch((err) => {

                reject(err)

            });
        })
    }

    createFolderBtn.onclick = () => {

        createFolder().then((folderid) => {

            myCreateFolderID = folderid;

            console.log(folderid)
        }).catch((err) => {
            console.log(err)
        })

    }
    function createFolder() {

        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        var fileMetadata = {
            name: 'electron Example Folder ' + new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            mimeType: 'application/vnd.google-apps.folder',
            appProperties: {
                app: "electronExample"
            },
            parents: ["root"]
        };

        return new Promise((resolve, reject) => {
            drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            }, function (err, folder) {
                if (err) {
                    // Handle error
                    console.log(err)
                    reject(err)
                } else {

                    uploadPathText.innerText = "Path：" + fileMetadata.name + " ID：" + folder.data.id
                    console.log(folder.data.id)
                    resolve(folder.data.id)
                }
            });
        })
    }

    uplodaFileBtn.onclick = () => {

        const imageFolder = app.getAppPath() + "\\uploadFolder"
        var counter = 0;

        fs.readdir(imageFolder, (err, files) => {

            for (let i = 0; i < files.length; i++) {

                const file = files[i];

                const localFilePath = imageFolder + "\\" + file
                const mimeType = mime.lookup(file)
                const filename = file.split('.')[0]

                const uploadFromBase64 = () => {
                    fs.readFile(localFilePath, (err, data) => {
                        // data is base64
                        console.log(data)
                        if (mimeType == 'image/jpeg' || mimeType == 'image/png')
                            ipcRenderer.send('uploadFile', data, file, mimeType, myCreateFolderID)
                    })
                }

                const uploadFromReadStream = () => {
                    ipcRenderer.send('uploadFile', localFilePath, file, mimeType, myCreateFolderID)
                }

                // uploadFromBase64()
                setTimeout(uploadFromReadStream, i * 10)

            }

            ipcRenderer.on('uploadEnd', (evnet, fileid) => {

                counter++;
                if (counter == files.length)
                    console.log('totalUploadEnd')

            })
        })

    }

    downloadFileBtn.onclick = async () => {

        fs.mkdirSync(app.getAppPath() + "\\downloadFolder", { recursive: true })

        try {

            let files = await listFiles();
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                const localFilePath = app.getAppPath() + "\\downloadFolder" + "\\" + file.name

                ipcRenderer.send('downloadFile', localFilePath, file.id, file.name)
                // downloadFile(file.id, file.name)
            }

        } catch (err) {

            console.log(err)
        }

    }

    async function Initialize(content) {

        console.log(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))

        function checkAccessToken(oAuth2Client) {

            const access_token = oAuth2Client.credentials.access_token;
            const refresh_token = oAuth2Client.credentials.refresh_token;
            const url = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + access_token

            return new Promise((resolve, reject) => {

                fetch(url, {
                    method: 'GET'
                }).then((response) => {

                    return response.json()
                }).then((res) => {

                    if (res.error) {
                        console.log('invalid_token')
                        resolve(true)
                    }

                    if (res.expires_in) {

                        console.log(res.expires_in + "：SEC")
                        if (res.expires_in < timer / 1000) {

                            //token_expired length of time less than timer length of time
                            console.log('token_expired length of time less than timer length of time')
                            resolve(true)
                        } else {

                            //token_expired length of time more than timer length of time
                            console.log('token_expired length of time more than timer length of time')
                            resolve(false)
                        }
                    }

                    if (!res.error && !res.expires_in) {
                        reject('Fail')
                    }

                }).catch((err) => {
                    reject(err)
                })

            })

        }

        function refreshToken(oAuth2Client) {

            let clonejson = Object.assign({}, oAuth2Client.credentials)

            return new Promise((resolve, reject) => {

                oAuth2Client.refreshAccessToken((err, tokens) => {

                    const newAccessToken = tokens.access_token;

                    clonejson.access_token = newAccessToken;

                    oAuth2Client.setCredentials(clonejson)

                    ipcRenderer.send('setCredentials', JSON.stringify(clonejson))

                    if (err) reject(err);

                    fs.writeFile(TOKEN_PATH, JSON.stringify(clonejson), (err) => {
                        if (err) return console.error(err);

                        resolve(true);
                        console.log('Token stored to', TOKEN_PATH);
                    });

                });

            })

        }

        async function isSignIn(oAuth2Client) {

            try {

                const checkResult = await checkAccessToken(oAuth2Client);
                console.log(checkResult)
                if (checkResult) {
                    const refreshResult = await refreshToken(oAuth2Client);
                    console.log(refreshResult)

                    return Promise.resolve(true);
                    // listFiles(oAuth2Client, 'root', 'init_List')
                } else {

                    return Promise.resolve(true);
                    // listFiles(oAuth2Client, 'root', 'init_List')
                }

            } catch (error) {

                return Promise.reject(error);
            }

        }

        let JsonFile = JSON.parse(content);
        GlobalOAuth2Client.setCredentials(JsonFile);
        ipcRenderer.send('setCredentials', JSON.stringify(JsonFile))
        let signRes = await isSignIn(GlobalOAuth2Client)

    }

    function Login() {

        function getOAuthCodeByInteraction(interactionWindow, authPageURL) {

            interactionWindow.loadURL(authPageURL, { userAgent: 'Chrome' });

            return new Promise((resolve, reject) => {

                const onclosed = () => {
                    reject('Interaction ended intentionally ;(');
                };

                interactionWindow.on('closed', onclosed);
                interactionWindow.on('page-title-updated', (ev) => {

                    const url = new URL(ev.sender.getURL());

                    // console.log(url.searchParams)

                    if (url.searchParams.get('approvalCode')) {

                        console.log('allow')

                        interactionWindow.removeListener('closed', onclosed);
                        interactionWindow.close();

                        return resolve(url.searchParams.get('approvalCode'));
                    }
                    if ((url.searchParams.get('response') || '').startsWith('error=')) {

                        console.log('reject')
                        interactionWindow.removeListener('closed', onclosed);
                        interactionWindow.close();

                        return reject(url.searchParams.get('response'));
                    }
                });
            });

        };

        function googleOAuthWindow(authWindow, authUrl) {

            authWindow.setMenu(null);

            authWindow.show();

            return new Promise((resolve, reject) => {

                getOAuthCodeByInteraction(authWindow, authUrl)
                    .then((res) => {

                        if (res != 'Interaction ended intentionally ;(') {
                            return resolve(res);
                        }

                        if (res == 'Interaction ended intentionally ;(') {
                            return reject('Fail:Authorization window colose');
                        }

                    }).catch((err) => {

                        if (err = 'error=access_denied') {
                            return reject('Fail: error=access_denied');
                        }

                    });
            })

        }

        async function getAccessToken(oAuth2Client) {

            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES
            });

            const authWindow = new BrowserWindow({
                width: 600,
                height: 800,
                show: false,
                'node-integration': false,
                'web-security': false
            });

            try {

                // google loginIn step
                const authenticationCode = await googleOAuthWindow(authWindow, authUrl);

                // get access token step
                const { tokens } = await oAuth2Client.getToken(authenticationCode);

                // set access token step
                oAuth2Client.setCredentials(tokens);

                ipcRenderer.send('setCredentials', JSON.stringify(tokens))


                // write access token step
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

                setInterval(() => {
                    Initialize(JSON.stringify(tokens))
                }, timer);

                StatusText.innerText = "Login Status：is sign in"
                console.log('GET access_token ok and stored!!!')

            } catch (error) {

                // catch any error
                console.log(error)
            }

        }

        getAccessToken(GlobalOAuth2Client);

    }

    function downloadFile(id, name) {

        const imageFolder = app.getAppPath() + "\\downloadFolder"
        const writeStream = fs.createWriteStream(imageFolder + "\\" + name)

        const drive = google.drive({
            version: 'v3',
            auth: GlobalOAuth2Client
        });

        drive.files.get(
            {
                fileId: id,
                alt: 'media'
            },
            {
                responseType: 'stream'
            }
        ).then((res) => {
            let progress = 0;
            console.log(res)

            res.data.on('end', () => {
                console.log('Done downloading file.');
            }).on('error', err => {
                console.log(err)
                console.error('Error downloading file.');
            }).on('data', chunk => {
                progress += chunk.length;
                console.log(`Received ${progress} bytes of data.`);
            }).pipe(writeStream);


        })


    }

}