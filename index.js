const { writeFile } = require('fs');
const fetch = require('node-fetch');

const admin = require('firebase-admin');
const firebaseAccount = require('./firebase.json');
admin.initializeApp({
    credential: admin.credential.cert(firebaseAccount),
    databaseURL: 'https://colbert-app.firebaseio.com/'
});
const lycee = admin.database().ref('lycee');

const FeedMe = require('feedme');
const mdlReference = admin.database().ref('mdl');

const oldmdl = require('./mdl.json');
const oldfb = require('./fb.json');
let mdl = {}, fb = {};

const { token } = require('./longlived.json');
const pageid = 265187623499450;
const graph = id => `https://graph.facebook.com/v2.11/${id}/posts?locale=fr-FR&access_token=${token}`;

const fbtask = fetch(graph(pageid))
    .then(res => res.json())
    .then(result =>
        lycee.set(result.data, err => {
            if (err) console.log('FB - Error');
            else {
                console.log('FB - Success');
                fb = result.data;
                writeFile('./fb.json', JSON.stringify(fb), err => err ? console.log(err) : err);
            }
        }))
    .catch(err => console.log(err));

const mdltask = fetch('https://mdl.attssystem.fr/index.php/feed/').then(res => res.body).then(buff => {
    const parser = new FeedMe(true);
    buff.pipe(parser);
    return new Promise(resolve => parser.on('end', () => resolve(parser)));
})
    .then(parser => {
        const result = parser.done().items;
        const fixed = result.map(elem =>
            Object.keys(elem)
                .reduce((obj, key) => Object.assign(obj, { [key.replace(/:/g, '_')]: elem[key] }), {}));
        //TODO: Write empty checker (in order to prevent erasing data, I guess)
        return mdlReference.set(fixed, err => {
            if (err) {
                console.log('MDL - Error');
            } else {
                console.log('MDL - Success');
                mdl = fixed;
                writeFile('./mdl.json', JSON.stringify(mdl), err => err ? console.log(err) : err);
            }
        });
    }).catch(err => console.log(err));

Promise.all([fbtask, mdltask]).then(async () => {
    const oldNewestFB = oldfb.reduce((acc, val) => Math.max(acc, new Date(val.created_time).getTime()), 0);
    
    const newFB = fb.filter(el => new Date(el.created_time).getTime() > oldNewestFB);
    const newMDL = mdl.filter(newel => !oldmdl.find(oldel => oldel.guid.text === newel.guid.text));

    if(newFB.length > 0) {
        const len = newFB.length;
        const plural = len >= 2 ? 's' : '';
        await sendCloudMessage('facebook', `${len === 1 ? 'Une' : len} nouvelle${plural} publication${plural} facebook !`, newFB[0].message);
    }

    if(newMDL.length > 0) {
        const len = newMDL.length;
        const plural = len >= 2 ? 's' : '';
        await sendCloudMessage('mdl', `${len === 1 ? 'Un' : len} nouve${len >= 2 ? 'aux' : 'l'} arcticle${plural} de la MDL !`, newFB[0].message);
    }
    
    // admin.app().delete();
});

async function sendCloudMessage(topic, title, content) {
    const message = {
        notification: {
            title,
            body: content
        },
        android: {
            notification: {
                icon: 'ic_colbert_white',
                color: '#d32f2f',
                ttl: 0
            }
        },
        topic
    };
    await admin.messaging().send(message)
        .then(mes => console.log('Successfuly sent notification: ', mes))
        .catch(err => console.log('An error has occured:', err));
}
