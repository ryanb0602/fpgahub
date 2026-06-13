#include <filesystem>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include "slang/ast/ASTVisitor.h"
#include "slang/ast/Compilation.h"
#include "slang/ast/Expression.h"
#include "slang/ast/Statement.h"
#include "slang/ast/symbols/CompilationUnitSymbols.h"
#include "slang/ast/symbols/InstanceSymbols.h"
#include "slang/syntax/SyntaxTree.h"
#include "slang/text/SourceManager.h"

#ifndef SLANG_WRAPPER_H
#define SLANG_WRAPPER_H

class slang_wrapper {
public:
  slang_wrapper() {
    int err = this->parse_working_directory();
    if (err > 1) {
      std::cerr << "Slang wrapper is not initialized properly." << std::endl;
    }
  }

private:
  // loads the current working directory into slang to be traversed
  int parse_working_directory();

  // used to store the syntax trees
  slang::SourceManager sourceManager;
  std::vector<std::shared_ptr<slang::syntax::SyntaxTree>> syntaxTrees;
  std::unique_ptr<slang::ast::Compilation> compilation;
};

#endif
