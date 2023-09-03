# Why Swig Instead of Gulp?

None of my reasons listed here is really a deal breaker for gulp. Gulp is great and has been for quite some time. If you use anything gulp offers outside of series/parallel, than you should keep on keeping on.

However, to explain why I created swig, I will use this page to rant about some of the minor annoyances that irritated me enough that I wanted to go ahead and see how difficult it would be to re-create a library with just simple series/parallel task composition and leave everything else as plain javascript.

And please note, this is all [just, like, my opinion, man](https://knowyourmeme.com/memes/thats-just-like-your-opinion-man).

### Size and Complexity

Despite Gulp only having a small API surface, it seems a bit bloated with lots of stuff I've never needed:

```
npx howfat@latest gulp
gulp@4.0.2 (457 deps, 9.55mb, 3468 files, ©MIT)
```

Swig has around 200 lines of meaty code and everything else is just to make it look pretty and work in any flavor of javascript/typescript (the series/parallel/task functionality is fairly straight-forward). The package also includes the sources files, source maps and type definition files for optimal developer experience, multiplied by 2 because of being a dual ESM/CommonJS package. Despite the extra developer-friendly files, Swig downloads fast and has **zero** dependencies:

```
npx howfat@latest swig-cli
swig-cli@0.0.5 (173.44kb, 49 files, ©MIT)
```

### Glup is hard to type

Someone call me a [wambulance](https://idioms.thefreedictionary.com/someone+call+the+wambulance), because I think "gulp" is hard to type. Even as I'm typing this documentation I keep typing "glup" or "gupl" or "gulup" "gup". I realize I could just slow down when I type it or learn to type better, or create an alias to something easier but... I'm so lazy I just created this whole alternate library instead.

Oh man, while writing docs I noticed squiggles under a link I put to this file from the main readme. Of course I spelled it wrong. I'm leaving it that way.

### Gulp security warnings

Gulp is usually used as a dev dependency, so the command `npm audit --omit=dev` shows no issues with gulp. But every time I do other npm operations like simply installing gulp or running `npm install`, I have to look at message about half a dozen critical vulnerabilities and do a double-take and maybe run an extra `npm audit` to make sure it's just gulp again and not another package:

```
7 vulnerabilities (1 moderate, 6 high)
```

The maintainers of gulp don't seem too interested in this, which I get - many people have a similar sentiment towards `npm audit`: https://overreacted.io/npm-audit-broken-by-design/. But having to ignore that or configure every project with config to ignore it is annoying. On top of this, most of the vulnerabilities are for dependencies of gulp functionality I don't even use.

### Software needs glue and the glue should be simple

A lot of modern software development is all about "the glue" - wiring all sorts of miscellaneous things together. An important feature of the glue is that it should be really simple rather being yet another framework to learn and remember. I should be able to come back to a project and take one glance at the dev automation tasks and immediately recognize what it does because it's just plain code mixed with helper functions with descriptive names - nothing fancy going on.

I think gulp helps with that, but I feel like it attempts to go beyond a little glue and starts to fall into the category of things that need glue rather than being the glue itself. I want to just be able to write code in a language I already know and use any old utility/helper function to do whatever task I need done. And if I can do that without trying to figure out quirks of someone else's framework, that's ideal. That's why I've kept swig as simple as possible - you just pass any functions to series and parallel and it'll run them - that's it. And if you need some other tool, that's fine too.

This actually isn't that different of a philosophy to gulp, but they have some mixed messages. For example, they have this message (https://gulpjs.com/docs/en/getting-started/javascript-and-gulpfiles):

```
"Although a few utilities are provided to simplify working with the filesystem and command line, everything else you write is pure JavaScript."
```

But then they turn around and introduce some of their not-pure-javascript custom framework stuff:
- Custom `src` and `dest` file manipulation methods
- Async completions and task completion signaling differentiated between return of streams, promises, event emitters, child processes and observables
- Their particular choice in glob strategy
- A whole plugin architecture
- Custom file watcher implementation
- Custom task registry
- Their custom implementation of virtual files

None of this is bad - I just feel like there's a bit more than just "a few helper functions" instead of being mostly pure javascript for task automation. My opinion is that some of these features fall into the category of "helpers that should be in a separate library" like src/dest/symLink, and others fall into the category of "you're trying to do too much" like determining error behavior based on the return values of functions. My hot take is that if you have super custom behavior you want based on what's happening in your tasks, you should write your super custom behavior yourself rather than rely on someone else's opinion of how that super custom scenario should happen. Or perhaps figure out a way to wire up the custom error behavior and task completion signaling without interfering with the base library's optimal ignorance of what the tasks do or how they do it.

For example, instead of returning a child process with `exec()` and trying to remember what the library does differently based on it, the task that calls exec should evaluate the result and decide for itself what the state of the currently running top-level task should be (like whether sibling parallel tasks should complete, whether global continuation is ok or not, etc). If that means using some custom helper logic and global state - so be it. That's far and away the better design choice than relying on poorly documented opinionated library behavior for custom scenarios.

Why not just use the default of allowing parallel tasks to complete (with `await Promise.allSettled`) and failing after they all return, rather than adding additional complex logic to decide whether to break stuff that's in the middle of doing things. The library consumer did specify `parallel` after all, so it seems reasonable to assume that these tasks are ok to run to completion regardless of the status of their siblings. If for some reason you want to fail faster, that should be left to the consumer, not something wrapped into the library. Again - just my opinion.

### Logging and Anonymous Functions

While using gulp I started moving common functions repeatedly in different projects into  a helper library. The nature of these is that they sometimes take parameters. So a convenient thing to do is to define a task like this:

```javascript
const dockerProjectName = 'my-project-name'
export const dockerUp = series(
  syncEnvFiles,
  () => nodeCliUtils.dockerDepsUpDetached(dockerProjectName)
)
```

No big deal - this works great in gulp. Except... when logged you get something like this:

```
[12:32:51] Starting 'dockerUp'...
[12:32:51] Starting 'syncEnvFiles'...
[12:32:51] Finished 'syncEnvFiles' after 21 ms
[12:32:51] Starting '<anonymous>'...
[+] Running 1/1
 ✔ Container bank_postgres  Started                                                                                                                        0.5s
[12:32:53] Finished '<anonymous>' after 1.72 s
[12:32:53] Finished 'dockerUp' after 1.74 s
```

Ok, it's not that big a deal to see `<anonymous>` in this case - I know what it was. But what if my task is more complicated and has lots of steps and stuff is running in parallel and I don't know which anonymous task is what? Hrm, seems like something people would be interested in - the ability to label an anonymous function for logging purposes.

I'm not the only one that wanted this - there was a github issue and work was completed a number of years ago: https://github.com/gulpjs/gulp/issues/858. They seem to have multiple ways of handling this. One is to set a `displayName` property on the anonymous function (see https://gulpjs.com/docs/en/api/task/#task-metadata) and another is to wrap it in a task function with the signature `task([taskName], taskFunction)`. I couldn't find a way for the `displayName` function to work with the newer modern syntax because there's no way to dynamically apply a displayName property to an anonymous function without first referencing it (assigning it to a non-anonymous method). And the `task` syntax is just unfortunate... adding more code in order to get less code, for a grand total of ... about the same amount of code. Also have to mix in their custom stuff instead of using plain functions, once again.

So somewhat ironically, in the quest to write less code (re-use functions by passing anonymous functions with different params), the solutions actually require more code than simply writing a named wrapper function or factory method, which is I assume what people do (or perhaps they ignore the `<anonymous>` log messages or just `console.log` stuff...).

My solution was simply to allow passing label/function tuples in addition to functions:

```javascript
const dockerProjectName = 'my-project-name'
export const dockerUp = series(
  syncEnvFiles,
  ['dockerUp', () => nodeCliUtils.dockerDepsUpDetached(dockerProjectName)]
)
```

### Out of date documentation

They added new ES syntax support at some point, but most (almost all?) of their docs still reference all the old stuff. Seems their github readme is somewhat out of sync with their website (https://gulpjs.com/).

Website also has dead links, like this blurb:

```
"For a more advanced dive into this topic and the full list of supported extensions, see our gulpfile transpilation documentation."
```

Points directly to https://gulpjs.com/docs/en/documentation-missing:

```
"
Excuse our dust!

We're in the process of rewriting all our documentation and some of the links we've added to completed docs haven't been written yet. You've likely clicked on one of those to end up here. We're sorry about that but please check back later on the topic you're interested in. If you want to help out, we'll happily accept a Pull Request for this missing documentation.

-The Gulp Team
"
```

Except I think it's been like this for quite a while.

### Somewhat abandoned codebase?

Most of their repos haven't been touched in several years. That's actually a good thing if the library is just that good, or a bad thing if there's just no one paying attention to it anymore. Hard to tell, but combined with the out-of-date documentation - not a great sign.

### Support for different flavors of javascript/typescript

Gulp supports different javascript flavors (esm vs commonjs) in addition to typescript, but it's very wonky IMO. It includes the need to pass flags when you call gulp, meaning you have to some extra stuff depending on your setup, like add an npm alias and take that performance hit/delay, add additional config, install other modules, etc. And if you're using a global gulp install, it get's a little more complicated.

With swig, I've chosen to do some no-no stuff, but stuff that seems to work really well in order to allow the consumer to use many combinations of swigfile, swigfile syntax, project type, in addition to typescript via ts-node, but without having to pass additional params. You can name your file with `.js` and it'll work as long as the syntax matches your package.json type, or you can use `.cjs` in any project type with commonjs syntax and `.mjs` in any project type with esm syntax, and `.ts` as long as you have `ts-node` installed in the project.
