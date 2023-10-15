function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _ts_generator(thisArg, body) {
    var f, y, t, g, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    };
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
import { parallel, series } from "swig-cli";
function task1() {
    return _task1.apply(this, arguments);
}
function _task1() {
    _task1 = _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from task1");
            return [
                2
            ];
        });
    });
    return _task1.apply(this, arguments);
}
function task2() {
    return _task2.apply(this, arguments);
}
function _task2() {
    _task2 = _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from task2");
            return [
                2
            ];
        });
    });
    return _task2.apply(this, arguments);
}
function task3() {
    return _task3.apply(this, arguments);
}
function _task3() {
    _task3 = _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from task3");
            return [
                2
            ];
        });
    });
    return _task3.apply(this, arguments);
}
function task4() {
    return _task4.apply(this, arguments);
}
function _task4() {
    _task4 = _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from task4");
            return [
                2
            ];
        });
    });
    return _task4.apply(this, arguments);
}
function task5() {
    return _task5.apply(this, arguments);
}
function _task5() {
    _task5 = _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from task5");
            return [
                2
            ];
        });
    });
    return _task5.apply(this, arguments);
}
export var allSeries = series(task1, task2, task3, task4, task5);
export var allParallel = parallel(task1, task2, task3, task4, task5);
export var mixed = series(task1, parallel(task2, task3), task4, task5);
export var single = task1;
export var withAnon = series(task1, /*#__PURE__*/ _async_to_generator(function() {
    return _ts_generator(this, function(_state) {
        console.log("This is a console message from an anonymous task");
        return [
            2
        ];
    });
}));
export var withNamedAnon = series(task1, [
    "helloWorld",
    /*#__PURE__*/ _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            console.log("This is a console message from a named anonymous task called helloWorld");
            return [
                2
            ];
        });
    })
]);
export var MyClass = function MyClass() {
    "use strict";
    _class_call_check(this, MyClass);
};

