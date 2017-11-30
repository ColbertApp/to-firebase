const fs = require('fs');
const request = require('request');
const success = [false, false];

const admin = require('firebase-admin');
const firebaseAccount = require('./firebase.json');
admin.initializeApp({
    credential: admin.credential.cert(firebaseAccount),
    databaseURL: 'https://colbert-app.firebaseio.com/'
});
const lycee = admin.database().ref('lycee');

const token = JSON.parse(fs.readFileSync('./longlived.json')).token;
const pageid = 265187623499450;
const graph = id => `https://graph.facebook.com/v2.11/${id}/posts?locale=fr-FR&access_token=${token}`;

request(graph(pageid), (err, res, body) => {
    const result = JSON.parse(body);
    lycee.set(result.data, err => {
        if (err) {
            console.log('FB - Error');
            return;
        }
        console.log('FB - Success');
        success[0] = true;
        endIfFinished();
    });
});

//TODO: Write empty checker
const FeedMe = require('feedme');
const mdl = admin.database().ref('mdl');
require('http').get('http://attssystem.fr/wordpress/index.php/feed/', res => {
    const parser = new FeedMe(true);
    res.pipe(parser);
    parser.on('end', () => mdl.set(parser.done().items, err => {
        if(err) {
            console.log('MDL - Error');
            return;
        }
        console.log('MDL - Success');
        success[1] = true;
        endIfFinished();
    }));
});

function endIfFinished() {
    if (Math.min(...success)) process.exit();
}
