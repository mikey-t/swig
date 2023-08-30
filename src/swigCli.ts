#!/usr/bin/env node

import { getSwigInstance } from './singletonManager.js'

getSwigInstance().runMainAsync()
