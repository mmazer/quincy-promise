var expect = require('chai').expect;
var sinon = require('sinon');
var QN = require('quincy');

describe('Promise', function() {

  var Promise = require('../../lib/promise');

  describe('constructor', function() {
    it('should return a default promise when no resolver is given', function() {
      var p = new Promise();
      expect(p.isSettled()).to.be.false;
      expect(p.isFulfilled()).to.be.false;
      expect(p.isRejected()).to.be.false;

      expect(function() {
        p.value();
      }).to.throw('cannot get value from unfulfilled promise');

      expect(function() {
        p.reason();
      }).to.throw('cannot get reason from unrejected promise');
    });

    it('should call the resolver function', function() {
      var spy = sinon.spy();
      new Promise(spy);
      expect(spy.called).to.be.true;
    });

    it('should call the resolver function with the resolve callbac',
      function(done) {
        var p = new Promise(function(resolve) {
          resolve('resolved');
        });

        p.then(function(value) {
          expect(value).to.equal('resolved');
          done();
        });
      });

    it('should call the resolver function with the reject callback',
      function(done) {
        var p = new Promise(function(resolve, reject) {
          reject('rejected');
        });

        p['catch'](function(reason) {
          expect(reason).to.equal('rejected');
          done();
        });
      });

    it('should raise an error if a resolver is given but it is not a function', function() {
      var r = {};
      expect(function() { new Promise(r);}).to.throw('promise resolver must be a function');

    });

    it('should implicitly reject the promise if the resolver throws an error', function() {
      var p = new Promise(function() { throw new Error('promise constructor callback error');});
      expect(p.isSettled()).to.be.true;
      expect(p.isRejected()).to.be.true;
    });

    it('should return a promise that adopts the fulfilled state of a promise passed to the resolve function',
       function(done) {
         var p = new Promise(function(resolve) {
           resolve(Promise.resolve(10));
         });
         p.peek(function(value) {
           expect(p.isFulfilled()).to.be.true;
           expect(value).to.equal(10);
           done();
         });
       });

    it('should return a promise that adopts the rejected state of a promise passed to the resolve function',
       function(done) {
         var err = new Error();
         var p = new Promise(function(resolve) {
           resolve(Promise.reject(err));
         });
         p.peek(function(reason) {
           expect(p.isRejected()).to.be.true;
           expect(reason).to.equal(err);
           done();
         });
       });
  });

  describe('then', function() {
    it('should return a new promise in the pending state', function() {
      var p = new Promise();
      var t = p.then();
      expect(t).to.be.defined;
      expect(t.isSettled()).to.be.false;
    });

    it('should queue the handlers', function() {
      var p = new Promise();
      p.then(function() {}, function() { });
      expect(p._handlers.length).to.equal(1);

    });

    it('should set the value of the returned promise to the value returned by the onFulfilled handler',
      function(done) {
        var promise = new Promise(function(resolve) { resolve(10);});
        var p = promise.then(function(v) { return v + 10;});
        p.then(function(result) {
          expect(result).to.equal(20);
          done();
        });
      });

    it('should set the value of the returned promise to the value returned by the onRejected handler',
       function(done) {
         new Promise(function(resolve, reject) { reject(10);})
         .then(void 0, function(v) { return v + 10;})
         .then(function(result) {
           expect(result).to.equal(20);
           done();
         });
       });

    it('should set the value of the returned promise to original value if the onFulfilled handler does not return a value',
       function(done) {
         new Promise(function(resolve) { resolve(10);})
         .then(function() {})
         .then(function(result) {
           expect(result).to.equal(10);
           done();
         });
       });

    it('should set the reason of the returned promise to the original reason if the onRejected handler does not return a value',
      function(done) {
        var err = new Error('error');
        new Promise(function(resolve, reject) { reject(err); })
        .then(void 0, function() {})
        .then(void 0, function(reason) {
          expect(reason).to.equal(err);
          done();
        });

      });

    it('should set the value of the returned promise to the rejected state if the onFulfilled handler raises an error',
       function(done) {
         var err = new Error();
         new Promise(function(resolve) { resolve(10);})
         .then(function() { throw err;})
         .then(void 0, function(result) {
           expect(result).to.equal(err);
           done();
         });

       });

    it('should set the returned promise to rejected if the returned value from either handler is equal to the returned promise',
       function(done) {
         var p1 = new Promise(function(resolve) { resolve(10);});
         var p2 = p1.then(function() { return p2;});
         p2.then(void 0, function(err) {
           expect(err.message).to.equal('illegal state: promise cannot be resolved with itself');
           done();
         });

       });

    it('should return a promise that adopts the state of a promise returned by a handler',
       function(done) {
         new Promise(function(resolve) { resolve(10);})
         .then(function() { return Promise.resolve(20);})
         .then(function(result) {
           expect(result).to.equal(20);
           done();
         });
       });

  });

  describe('peek', function() {
    it('should invoke the handler for a fulfilled value',  function(done) {
      new Promise(function(resolve) { resolve(10); })
      .peek(function(value) {
        expect(value).to.equal(10);
        done();
      });

    });

    it('should invoke the handler with a rejected reason',  function(done) {
      var p = new Promise(function(resolve, reject) { reject(10); });
      p.peek(function(value) {
        expect(value).to.equal(10);
        done();
      });

    });

    it('should not modify the final value of the promise',  function(done) {
      var p = new Promise(function(resolve) { resolve(10); });
      p.peek(function() {
        return 100;
      }).then(function(value) {
        expect(value).to.equal(10);
        done();
      });

    });

    it('should propagate the failure reason to subsequent onRejected handlers',  function(done) {
      var p = new Promise(function(resolve, reject) { reject('rejected'); });
      p.peek(function() {
        return;
      }).then(void 0, function(reason) {
        expect(reason).to.equal('rejected');
        done();
      });
    });
  });

  describe('finally', function() {
    it('should invoke the handler for a rejected promise', function(done) {
      var err = new Error('rejected');
      var p = new Promise(function(resolve, reject) { reject(err); });
      p['finally'](function(reason) {
        expect(reason).to.equal(err);
        done();
      });
    });

    it('should invoke the handler for a resolved promise', function(done) {
      var p = new Promise(function(resolve) { resolve(10); });
      p['finally'](function(value) {
        expect(value).to.equal(10);
        done();
      });
    });

    it('should invoke the global Promise.onerror function if no onRejected handler is provided', function(done) {
      Promise.onerror = function(reason) {
        expect(reason).to.equal(10);
        Promise.onerror = null;
        done();
      };
      var p = new Promise(function(resolve, reject) { reject(10); });
      p['finally']();
    });
  });

  describe('done', function() {
    it('should invoke the handler for a rejected promise', function(done) {
      var err = new Error('rejected');
      var p = new Promise(function(resolve, reject) { reject(err); });
      p.done(void 0, function(reason) {
        expect(reason).to.equal(err);
        done();
      });
    });

    it('should invoke the handler for a resolved promise', function(done) {
      var p = new Promise(function(resolve) { resolve(10); });
      p.done(function(value) {
        expect(value).to.equal(10);
        done();
      });
    });

    it('should invoke the global Promise.onerror function if no onRejected handler is provided', function(done) {
      Promise.onerror = function(reason) {
        expect(reason).to.equal(10);
        Promise.onerror = null;
        done();
      };
      var p = new Promise(function(resolve, reject) { reject(10); });
      p.done();
    });
  });

  describe('bind', function() {
    it('should return the promise that calls the onResolved handler with thisArg', function(done) {
      var obj = {a: 1};
      Promise.resolve(10).bind(obj)
        .then(function(v) {
          expect(this).to.equal(obj);
          expect(v).to.equal(10);
          done();
        });
    });

    it('should return the promise that calls the onRejected handler with thisArg', function(done) {
      var obj = {a: 1};
      Promise.reject(10).bind(obj)
        .peek(function(v) {
          expect(this).to.equal(obj);
          expect(v).to.equal(10);
          done();
        });
    });

    it('should maintain thisArg for all child promises', function(done) {
      var obj = {a: 1};
      Promise.reject(10).bind(obj)
        .then(QN.identity)
        .peek(function(v) {
          expect(this).to.equal(obj);
          expect(v).to.equal(10);
          done();
        });
    });
  });

  describe('collect', function() {
    it('should apply the predicate to the fulfilled value', function(done) {
      var p = Promise.resolve(10);
      p.collect(function(value) {
        return value > 0;
      }, QN.identity)
      .then(function(value) {
        expect(value).to.equal(10);
        done();
      });
    });

    it('should apply the map function to the fulfilled value', function(done) {
      var p = Promise.resolve(10);
      p.collect(QN.always, function(value) {
        return value * 10;
      })
      .then(function(value) {
        expect(value).to.equal(100);
        done();
      });
    });

    it('should return a rejected promise if the predicate is not satisfied', function(done) {
      var p = Promise.resolve(10);
      p.collect(function(value) {
        return value > 100;
      }, QN.identity)
      ['catch'](function(reason) {
        expect(reason.message).to.equal('no such promise value');
        done();
      });
    });
  });

  describe('recover', function() {
    it('should return a fulfilled promise from a rejected promise', function(done) {
      var p = Promise.reject(10);
      p.recover(function() {
        return 100;
      }).then(function(value) {
        expect(value).to.equal(100);
        done();
      });
    });

    it('should return a rejected promise if the handler does not return a value', function(done) {

      var p = Promise.reject(10);
      p.recover(function() {
        return;
      })['catch'](function(reason) {
        expect(reason).to.equal(10);
        done();
      });
    });
  });

  describe('spread', function() {
    it('should apply the array value to the fulfilled handler', function(done) {
      var p = new Promise(function(resolve) { resolve([1, 2, 3]); });
      var spy = sinon.spy();
      p.spread(spy).peek(function() {
        expect(spy.getCall(0).calledWith(1, 2, 3)).to.be.true;
        done();
      });
    });

    it('should apply convert a non-array value to an array', function(done) {
      var p = new Promise(function(resolve) { resolve(1); });
      var spy = sinon.spy();
      p.spread(spy).peek(function() {
        expect(spy.called).to.be.true;
        done();
      });
    });
  });

  describe('static', function() {

    describe('resolve', function() {
      it('should return a new promise that adopts the state of a thenable', function(done) {
        var p = Promise.resolve(new Promise(function(resolve) { resolve(3);}));
        expect(p).to.be.defined;
        p.then(function(result) {
          expect(p.isSettled()).to.be.true;
          expect(result).to.equal(3);
          done();
        });

      });

      it('should accept undefined or null values', function() {
        var p = Promise.resolve();
        expect(p).to.be.defined;
        expect(p.isSettled()).to.be.true;
        expect(p.state).to.deep.equal({fulfilled:true, value:undefined});
      });

      it('should return a resolved promise with the specified value', function() {
        var p = Promise.resolve(10);
        expect(p).to.be.defined;
        expect(p.isSettled()).to.be.true;
        expect(p.state).to.deep.equal({fulfilled:true, value:10});
      });
    });

    describe('all', function() {
      it('should only accept a non-empty iterable', function() {
        expect(function() { Promise.all({});}).to.throw('Promise.all: non-empty iterable required');
        expect(function() { Promise.all([]);}).to.throw('Promise.all: non-empty iterable required');
      });

      it('should resolve an array of promise objects', function(done) {
        var p = Promise.all(QN.map(function(v) { return Promise.resolve(v);}, [1, 2, 3]));
        p.then(function(result) {
          expect(result).to.deep.equal([1, 2, 3]);
        })['finally'](function() { done();});
      });

      it('should resolve an array of promise or  plain objects', function(done) {
        var p = Promise.all([Promise.resolve(1), 2, Promise.resolve(3)]);
        p.then(function(result) {
          expect(result).to.deep.equal([1, 2, 3]);
        })['finally'](function() { done();});
      });

      it('should return a promise that is rejected if any promises raise an error', function(done) {
        var err = new Error('rejectedAll');
        var p = Promise.all([Promise.reject(err), Promise.resolve(3)]);
        p['catch'](function(err) {
          expect(err).to.equal(err);
        })['finally'](function() { done();});

      });
    });

    describe('race', function() {
      it('should only accept a non-empty iterable', function() {
        expect(function() { Promise.race({});}).to.throw('Promise.race: non-empty iterable required');
      });

      it('should raise an error for an empty iterable', function() {
        expect(function() {
          Promise.race([]);
        }).to.throw('Promise.race: non-empty iterable required');
      });

      it('should return a promise that is resolved when the first promise in the list resolves',
        function(done) {
          var p1 = new Promise(function(resolve) {
            setTimeout(resolve, 500, 'one');
          });
          var p2 = new Promise(function(resolve) {
            setTimeout(resolve, 100, 'two');
          });
          Promise.race([p1, p2])
          .then(function(value) {
            expect(value).to.equal('two');
            done();
          });
        });

      it('should return a promise that is resolved with the first value in the list',
        function(done) {
          var p1 = new Promise(function(resolve) {
            setTimeout(resolve, 500, 'one');
          });
          Promise.race([p1, 'two'])
          .then(function(value) {
            expect(value).to.equal('two');
            done();
          });
        });
    });

    describe('defer', function() {
      it('should return a new Deferred that is not completed', function() {
        var d = Promise.defer();
        expect(!d.isCompleted());
        expect(d.promise).to.be.defined;
      });

      it('should return a future with a promise that is in the pending state', function() {
        var d = Promise.defer();
        var p = d.promise;
        expect(!p.isSettled()).to.be.true;
      });
    });

    describe('resolve', function() {
      it('should complete the promise', function() {
        var d = Promise.defer();
        d.resolve(10);
        var p = d.promise;
        expect(p.isSettled()).to.be.true;
      });

      it('should set the successful result on the promise', function() {
        var d = Promise.defer();
        d.resolve(10);
        var p = d.promise;
        expect(p.state).to.deep.equal({fulfilled:true, value:10});
      });

      it('should have no effect if called on succesfully completed future', function() {
        var d = Promise.defer();
        d.resolve(10);
        d.resolve(1);
        expect(d.promise.state).to.deep.equal({fulfilled:true, value:10});
      });

      it('should have no effect if called on failed future', function() {
        var d = Promise.defer();
        d.reject(new Error('failed'));
        d.resolve(10);
        expect(d.promise.state).to.deep.equal({rejected:true, value:new Error('failed')});

      });

      it('should apply the result to the fulfilled handler', function() {
        var d = Promise.defer();
        var spy = sinon.spy();
        d.promise.then(spy);
        d.resolve(10);
        expect(spy.called).to.be.true;

      });
    });

    describe('reject', function() {
      it('should complete the promise', function() {
        var d = Promise.defer();
        d.reject(10);
        var p = d.promise;
        expect(p.isSettled()).to.be.true;
      });

      it('should set the failed result on the promise', function() {
        var d = Promise.defer();
        d.reject(10);
        var p = d.promise;
        expect(p.state).to.deep.equal({rejected:true, value:10});
      });

      it('should have no effect if called on a failed future', function() {
        var d = Promise.defer();
        d.reject(new Error('failed'));
        d.reject(new Error('failed again'));
        expect(d.promise.state).to.deep.equal({rejected:true, value:new Error('failed')});
      });

      it('should have no effect if called on successful future', function() {
        var d = Promise.defer();
        d.resolve(10);
        d.reject(new Error('failed'));
        expect(d.promise.state).to.deep.equal({fulfilled:true, value:10});

      });

      it('should apply the cause to the rejected handler', function() {
        var d = Promise.defer();
        var spy = sinon.spy();
        d.promise.then(void 0, spy);
        d.reject(10);
        expect(spy.getCall(0).calledWith(10)).to.be.true;

      });

      it('should not apply the result to the fulfilled handler', function() {
        var d = Promise.defer();
        var spy = sinon.spy();
        d.promise.then(spy);
        d.reject(10);
        expect(spy.called).to.be.false;


      });
    });

    describe('try', function() {
      it('should return a that is fulfilled with the return value of the function', function(done) {
        var p = Promise.try(function() { return 'one'; });
        expect(p.isFulfilled()).to.be.true;
        p.then(function(val) {
          expect(val).to.equal('one');
          done();
        });
      });

      it('should apply the arguments to the function', function(done) {
        var p = Promise.try(function(x, y) { return [x, y]; }, null, 1, 2);
        expect(p.isFulfilled()).to.be.true;
        p.then(function(val) {
          expect(val).to.deep.equal([1, 2]);
          done();
        });
      });

      it('should return a that is rejected with the error thrown by the function', function(done) {
        var err = new Error('error');
        var p = Promise.try(function() { throw err;});
        expect(p.isRejected()).to.be.true;
        p.catch(function(err) {
          expect(err).to.equal(err);
          done();
        });
      });
    });
  });
});
