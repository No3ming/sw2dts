import * as fs from "fs";
import * as commandpost from "commandpost";
import converter from "./converter";

const pkg = require("../package.json");

interface RootOptions {
    stdin: boolean;
    output: string[];
}

const root = commandpost
    .create<RootOptions, { input_filename: string }>("sw2dts [input_filename]")
    .version(pkg.version, "-v, --version")
    .option("--stdin", "Input from standard input.")
    .option("-o, --output <output_filename>", "Output to file.")
    .action((opts, args) => {
        const output_filename = opts.output[0];
        let promise: Promise<string> = null;
        if (args.input_filename && opts.stdin) {
            process.stderr.write("Invalid parameters!\n");
            process.stderr.write(root.helpText());
        } else if (args.input_filename) {
            promise = fromFile(args.input_filename);
        } else if (opts.stdin) {
            promise = fromStdin();
        } else {
            process.stdout.write(root.helpText());
        }
        if (promise == null) {
            return;
        }

        promise.then(input => {
            return converter(JSON.parse(input));
        }).then(model => {
            if (output_filename) {
                fs.writeFileSync(output_filename, model);
            } else {
                console.log(model);
            }
            process.exit(0);
        }).catch(errorHandler);
    });

commandpost
    .exec(root, process.argv)
    .catch(errorHandler);

function fromStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = "";
        let resolved = false;
        let callback = () => {
            if (resolved) {
                return;
            }
            if (data) {
                resolved = true;
                resolve(data);
            } else {
                throw new Error("Timeout, or stdin is empty.");
            }
        };
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", (chunk: any) => data += chunk);
        process.stdin.on("end", callback);
        setTimeout(callback, 1000);
    });
}

function fromFile(inputFileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let file = fs.readFileSync(inputFileName, { encoding: "utf-8" });
        resolve(file);
    });
}

function errorHandler(err: Error) {
    if (err instanceof Error) {
        console.error(err.stack);
    } else {
        console.error(err);
    }
    process.exit(1);
}