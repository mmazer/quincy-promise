var $ = require('quincy');

function nextTick(fn, arg1, arg2, arg3, arg4) {
  setTimeout(function() {
    fn(arg1, arg2, arg3, arg4);
  }, 4);
}

function handlerIter(handler) {
  handler.call(this._bindTo, this.state);
}

function getThenable(obj) {
  if (!$.isObject(obj) && !$.isFunction(obj)) return;

  var then = tryf($.get, null, 'then', obj);
  if (then.failure) return then;
  if (!$.isFunction(then.value)) return;

  then.value = then.value.bind(obj);
  return then;
}

function complete(promise, state) {
  if (promise.state) return;

  promise.state = state;
  $.forEach(handlerIter, promise._handlers, promise);
  promise._handlers = null;

  return promise;
}

function resolve(promise, onFulfilled, onRejected, result) {
  var handler = result.fulfilled ? onFulfilled : onRejected;
  var state = result.fulfilled ? 'fulfill' : 'reject';

  if (!$.isFunction(handler)) {
    resolvers[state](promise, result.value);
    return;
  }

  var mapped = applyHandler(handler, result.value, promise._bindTo);
  if (mapped.failure) {
    resolvers.reject(promise, mapped.cause);
    return;
  }

  var v = mapped.value;
  if (v === void 0) {
    resolvers[state](promise, result.value);
    return;
  }

  if (promise === v) {
    resolvers.reject(promise, new TypeError('illegal state: promise cannot be resolved with itself'));
    return;
  }

  var thenable = getThenable(v);
  if (!thenable) {
    resolvers.fulfill(promise, v);
    return;
  }

  if (thenable.success) adopt(thenable.value, promise);
  else resolvers.reject(promise, thenable.cause);

}

function finalResolver(promise, onFulfilled, onRejected, result) {
  var handler = result.fulfilled ? onFulfilled : onRejected;

  if (result.rejected && !handler) {
    if (Promise.onerror) handler = Promise.onerror;
    else throw result.value;
  }
  tryf(handler, promise._bindTo, result.value);
}

function adopt(then, promise) {
  try {
    then(function(value) {
      resolvers.fulfill(promise, value);
    }, function(reason) {
      resolvers.reject(promise, reason);
    });

  } catch (e) {
    resolvers.reject(promise, e);
  }
}

function applyHandler(handler, value, thisArg) {
  if (!$.isFunction(handler)) return toSuccess(value);
  else return tryf(handler, thisArg, value);
}

function fulfill(promise, value) {
  var thenable = getThenable(value);
  if (!thenable) {
    return complete(promise, { fulfilled: true, value: value });
  }

  if (thenable.success) adopt(thenable.value, promise);
  else reject(promise, thenable.cause);

  return promise;
}

function reject(promise, reason) {
  return complete(promise, { rejected: true, value: reason });
}

var resolvers = {
  fulfill: fulfill,
  reject: reject
};

function tryf(fn, thisArg /* args...*/) {
  // OPT: inline drop(2, arguments)
  var args = [];
  for (var i = 0, j = 2, l = arguments.length; j < l; i++, j++) {
    args[i] = arguments[j];
  }
  try {
    return toSuccess(fn.apply(thisArg, args));
  } catch (err) {
    return toFailure(err);
  }
}

function toSuccess(value) {
  return { success: true, value: value};
}

function toFailure(err) {
  return { failure: true, cause: err};
}

function Promise(resolver) {
  if (resolver !== void 0 && !$.isFunction(resolver)) throw new TypeError('promise resolver must be a function');
  this._handlers = [];
  var _this = this;
  if (resolver) {
    try {
      resolver(function(value) {
        resolvers.fulfill(_this, value); },
        function(reason) {
          resolvers.reject(_this, reason);
        });
    }catch (err) {
      resolvers.reject(this, err);
    }
  }
}

Promise.prototype._addHandler = function(handler) {
  this._handlers.push(handler);
};

Promise.prototype._then = function(promise, resolver, onFulfilled, onRejected) {

  if (!promise._bindTo) promise._bindTo = this._bindTo;

  if (this.isSettled()) {
    nextTick(resolver, promise, onFulfilled, onRejected, this.state);
  } else {
    this._addHandler(function(result) {
      resolver(promise, onFulfilled, onRejected, result);
    });
  }

  return promise;
};

Promise.prototype.isSettled = function() {
  return $.isSome(this.state);
};

Promise.prototype.isPending = function() {
  return !this.state;
};

Promise.prototype.isFulfilled = function() {
  return $.isSome(this.state) && this.state.fulfilled === true;
};

Promise.prototype.isRejected = function() {
  return $.isSome(this.state) && this.state.rejected === true;
};

Promise.prototype.value = function() {
  if (!this.isFulfilled()) throw Error('cannot get value from unfulfilled promise');

  return this.state.value;
};

Promise.prototype.reason = function() {
  if (!this.isRejected()) throw Error('cannot get reason from unrejected promise');

  return this.state.value;
};

Promise.prototype.then = function(onFulfilled, onRejected) {
  return this._then(new Promise(), resolve, onFulfilled, onRejected);
};

Promise.prototype['catch'] = function(handler) {
  return this.then(void 0, handler);
};

Promise.prototype.peek = function(handler) {
  return this.then(function(value) {
    tryf(handler, this, value);
  }, function(reason) {
    tryf(handler, this, reason);
  });
};

Promise.prototype.always = function(handler) {
  return this.then(handler, handler);
};

Promise.prototype['finally'] = function(handler) {
  this.done(handler, handler);
};

Promise.prototype.done = function(onResolved, onRejected) {
  this._then(new Promise(), finalResolver, onResolved, onRejected);
};

function bindTo(promise, thisArg) {
  promise._bindTo = thisArg;

  return promise;
}

Promise.prototype.bind = function(thisArg) {
  return this._then(bindTo(new Promise(), thisArg), resolve);
};

Promise.prototype.spread = function(fulfilled, rejected) {
  return this.then(function(array) {
    var args = array;
    if (!$.isArray(args)) args = [array];
    return fulfilled.apply(void 0, args);
  }, rejected);
};

Promise.prototype.collect = function(p, fn) {
  return this.then(function(value) {
    if (!p(value)) throw new Error('no such promise value');

    return fn(value);
  });

};

Promise.prototype.filter = function(p) {
  return this.collect(p, $.identity);
};

Promise.prototype.map = function(fn) {
  return this.collect($.always, fn);
};

Promise.prototype.recover = function(handler) {
  return this['catch'](function(reason) {
    var res = handler(reason);
    if (res === void 0) throw reason;
    else return res;
  });
};

// static methods for convenience without requiring future
Promise.resolve = function(obj) {
  return resolvers.fulfill(new Promise(), obj);
};

Promise.reject = function(reason) {
  return resolvers.reject(new Promise(), reason);
};

Promise['try'] = function() {
  var promise = new Promise();
  var res = tryf.apply(null, arguments);

  if (res.success) fulfill(promise, res.value);
  else reject(promise, res.cause);

  return promise;
};

Promise.all = function(promises) {
  if (!$.isIterable(promises) || $.isEmpty(promises)) {
    throw new TypeError('Promise.all: non-empty iterable required');
  }

  return new Promise(function(resolve, reject) {
    var pending = {
      remaining: promises.length,
      results: [],
      resolve: resolve,
      reject: reject
    };

    if (pending.remaining === 0) {
      pending.resolve(pending.results);
      return;
    }

    function onFulfilled(pending, i, v) {
      pending.results[i] = v;
      if (--(pending.remaining) === 0) pending.resolve(pending.results);
    }

    $.forEach(function(p, i) {
      if (Promise.is(p)) {
        var _this = this;
        p.then(function(value) {
          onFulfilled(_this, i, value);
        }, this.reject);
      }else {
        onFulfilled(this, i, p);
      }
    }, promises,  pending);
  });
};

Promise.race = function(promises) {
  if (!$.isIterable(promises) || $.isEmpty(promises)) {
    throw new TypeError('Promise.race: non-empty iterable required');
  }

  return new Promise(function(resolve, reject) {
    $.forEach(function(p) {
      if (Promise.is(p)) {
        p.then(resolve)['catch'](reject);
      }else {
        resolve(p);
      }
    }, promises, this);
  });
};

Promise.is = function(obj) {
  return ($.isSome(obj) && $.isFunction(obj.then));
};

function Deferred() {
  this.promise = new Promise();
}

Deferred.prototype.resolve = function(value) {
  if (this.isCompleted()) return;
  resolvers.fulfill(this.promise, value);

};

Deferred.prototype.reject = function(reason) {
  if (this.isCompleted()) return;
  resolvers.reject(this.promise, reason);

};

Deferred.prototype.isCompleted = function() {
  return this.promise.isSettled();
};

Promise.defer = function() {
  return new Deferred();
};

module.exports = Promise;
