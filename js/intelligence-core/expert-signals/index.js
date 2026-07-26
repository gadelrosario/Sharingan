'use strict';
const bdge=require('./bdge-signals'),fantasyland=require('./fantasyland-signals'),flockWr=require('./flock-wr-signals'),flockRb=require('./flock-rb-signals');
const bundles=Object.freeze([bdge,fantasyland,flockWr,flockRb]);
const principles=Object.freeze(bundles.flatMap(bundle=>bundle.principles));
const examples=Object.freeze(bundles.flatMap(bundle=>bundle.examples));
module.exports=Object.freeze({bundles,principles,examples,bdge,fantasyland,flockWr,flockRb});
