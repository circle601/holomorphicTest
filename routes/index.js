var express = require('express');
var router = express.Router();



// import paillier
const paillier = require('paillier-js');
const bigInt = require('big-integer');




var Jimp = require('jimp');




function Convolve(Image,Destination,Sise, weights) {
    var side = Math.round(Math.sqrt(weights.length));
    var halfSide = Math.floor(side / 2);
    var sw = Sise;
    var sh = Sise;
    // pad output by the convolution matrix
    var w = sw;
    var h = sh;
    // go through the destination image pixels
    var alphaFac = 1;
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var sy = y;
            var sx = x;
         
            // calculate the weighed sum of the source image pixels that
            // fall under the convolution matrix
            var Brightness = 0;
            for (var cy = 0; cy < side; cy++) {
                for (var cx = 0; cx < side; cx++) {
                    var scy = sy + cy - halfSide;
                    var scx = sx + cx - halfSide;
                    if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                        var wt = weights[cy * side + cx];
                        Brightness += GetBrightness(Image,scx, scy) * wt;
                    }
                }
            }
            Brightness = Math.min(Math.max(Brightness, 0), 255);
            Destination.setPixelColor(Jimp.rgbaToInt(Brightness, Brightness, Brightness, 255), x, y);
        }
    }
};

function EncryptImage(Image, Sise, publicKey) {
    var Result = [];
    for (var y = 0; y < Sise; y++) {
        for (var x = 0; x < Sise; x++) {
            Result[x + y * Sise] = publicKey.encrypt(255 + GetBrightness(Image, x, y));
            //publicKey.encrypt();
        }
    }
    return Result;
}

function GetBrightness(Image, X, Y) {
    brightness = Jimp.intToRGBA(Image.getPixelColor(X, Y)).r;
    return brightness;
}


function decryptImage(Data, Destination, Sise,ScaleFactor, Privatekey) {
    var side = Sise;

    for (var y = 0; y < side; y++) {
        for (var x = 0; x < side; x++) {
            //Privatekey.decrypt()
            let Num = (Data[x + y * side]);
            var Brightness;
            if (Num) {
                Brightness = (Privatekey.decrypt(Num) * ScaleFactor - 255); // m1 + m2
            } else {
                Brightness = 0;
            }
            Brightness = Math.min(Math.max(Brightness, 0), 255);
            Destination.setPixelColor(Jimp.rgbaToInt(Brightness, Brightness, Brightness, 255), x, y);
        }
    }
}



function EncryptedBrighten(Data, PublicKey) {
    var Result = [];
    for (var i = 0; i < Data.length; i++) {
        Result[i] = PublicKey.multiply(Data[i], 2);
    }
    return Result;
};


function EncryptedConvolve(Data, Sise, weights, PublicKey) {

  


    var side = Math.round(Math.sqrt(weights.length));

    console.log(side);

    var halfSide = Math.floor(side / 2);
    console.log(halfSide);


    var sw = Sise;
    var sh = Sise;
    // pad output by the convolution matrix
    var w = sw;
    var h = sh;
    var Result = [];
    // go through the destination image pixels
    var alphaFac = 1;
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var sy = y;
            var sx = x;

            var Brightness = null;

            // calculate the weighed sum of the source image pixels that
            // fall under the convolution matrix
           // var Brightness = 0;
            for (var cy = 0; cy < side; cy++) {
                for (var cx = 0; cx < side; cx++) {
                    var scy = sy + cy - halfSide;
                    var scx = sx + cx - halfSide;
                    if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                        let Pixel = Data[scy * Sise + scx];

                        var wt = weights[cy * side + cx];
                        if (wt == 0) {
                            continue;
                        }

                        if (Pixel) {
                            
                            if (wt < 0) {
                               // Pixel = Pixel.modInv(PublicKey._n2);
                                wt = -wt;
                            }
                            Pixel = PublicKey.multiply(Pixel, wt);
                        
                            if (Brightness == null) {
                                Brightness = Pixel;
                            } else {
                                Brightness = PublicKey.addition(Brightness, Pixel);
                            }
                        }
                       
                     
                       
                   }
                }
            }
            Result[x + y * Sise] = Brightness;
        }
    }
    return Result;
};






function distanceFromCenter(size, X, Y) {
    return Math.sqrt(Math.pow(X - size / 2, 2) + Math.pow(Y - size / 2, 2));
}


router.get('/image', function (req, res, next) {
    Jimp.read('https://upload.wikimedia.org/wikipedia/en/7/7d/Lenna_%28test_image%29.png')
        .then(lenna => {

            const size = 150;

            lenna = lenna
                .resize(size, size) // resize
                .quality(60) // set JPEG quality
                .greyscale().normalize(); 






        
            const black = [0, 0, 0, 255];
            const white = [255, 255, 255, 255];
            new Jimp(size, size, (err, image) => {
                //for (let x = 0; x < size; x++) {
                //    for (let y = 0; y < size; y++) {
                //        const brightness = Jimp.intToRGBA(lenna.getPixelColor(x, y)).r;
                 //       const colorToUse = distanceFromCenter(size, x, y) > size / 2 ? black :   [brightness, brightness, brightness, 255];
                //        const color = Jimp.rgbaToInt(...colorToUse);
                //        image.setPixelColor(color, x, y);
                //    }
               // }

               // Convolve(lenna, image, 500,[-2, -1, 0, -1, 1, 1, 0, 1, 2]);

                const { publicKey, privateKey } = paillier.generateRandomKeys(32);

                //replace the kernal with a face kernal
                decryptImage(EncryptedConvolve(EncryptImage(lenna, size, publicKey), size, [-1, 0, -1, 0, 5, 0, -1, 0, -1], publicKey), image, size, 1, privateKey);

                image.getBuffer(Jimp.MIME_JPEG, function (err, buffer) {
                    res.set("Content-Type", Jimp.MIME_JPEG);
                    res.send(buffer);
                });
            });




          //  var mainImage = new Jimp(10, 10, function (err, image) {
          //      Convolve(lenna, mainImage, [-2, -1, 0, -1, 1, 1, 0, 1, 2]);
//
            //    const white = [255, 255, 255, 255];
          //  });

            ///   mainImage.getBuffer(Jimp.MIME_JPEG, function (err, buffer) {
            //res.set("Content-Type", Jimp.MIME_JPEG);
          // res.send(buffer);
        //});

            ////image.getPixelColor(x, y); 
            //lenna = lenna.convolute([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]]);

          
            //.write('lena-small-bw.jpg'); // save
        })
        .catch(err => {
            console.error(err);
        });
});


/* GET home page. */
router.get('/', function (req, res, next) {
    const { publicKey, privateKey } = paillier.generateRandomKeys(128);


    let c1 = publicKey.encrypt(5);
    let c2 = publicKey.encrypt(1);
    let encryptedSum = publicKey.addition(c1, c2.modInv(publicKey._n2));



    let sum = privateKey.decrypt(encryptedSum); // m1 + m2
    res.status(200).end(JSON.stringify(sum));
    

    //c3 = bigInt(c1).multiply(bigInt(c2)).mod(publicKey._n2);

   // res.status(200).end(JSON.stringify({ A: publicKey.encrypt(5), B: publicKey.encrypt(5), C: publicKey._n2 }));



   
});

module.exports = router;
