module.exports = {
    "env": {
        "es6": true,
        "node": true,
        "browser": true
    },
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": true,
            "modules": true,
        }
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
    ],
    "plugins": [
        "react",
        "react-hooks"
    ],
    "rules": {
        "indent": [
            "error",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-console": [
            "warn"
        ],
        "no-param-reassign": [
            "error"
        ],
        "react/prop-types": [
            "off"
        ],
        "react-hooks/rules-of-hooks": [
            "error"
        ],
        "react-hooks/exhaustive-deps": [
            "warn"
        ],
    }
};