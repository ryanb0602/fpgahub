#include <filesystem>
#include <iostream>
#include <string>
#include <vector>

#include "slang/ast/Compilation.h"
#include "slang/ast/symbols/CompilationUnitSymbols.h"
#include "slang/ast/symbols/InstanceSymbols.h"
#include "slang/syntax/SyntaxTree.h"
#include "slang/text/SourceManager.h"

#ifndef SLANG_WRAPPER_H
#define SLANG_WRAPPER_H

namespace fs = std::filesystem;
class slang_wrapper {
public:
  int compile_current_dir();

private:
};

#endif
