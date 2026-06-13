#include <filesystem>
#include <iostream>
#include <memory>
#include <stack>
#include <string>
#include <vector>

#include "slang/ast/ASTVisitor.h"
#include "slang/ast/Compilation.h"
#include "slang/ast/Expression.h"
#include "slang/ast/Statement.h"
#include "slang/ast/symbols/CompilationUnitSymbols.h"
#include "slang/ast/symbols/InstanceSymbols.h"
#include "slang/diagnostics/DiagnosticEngine.h"
#include "slang/diagnostics/TextDiagnosticClient.h"
#include "slang/syntax/SyntaxTree.h"
#include "slang/text/SourceManager.h"

#include "../include/graph.h"

#include <unordered_set>

#ifndef SLANG_WRAPPER_H
#define SLANG_WRAPPER_H

class slang_wrapper {
public:
  slang_wrapper() {
    int err = this->parse_working_directory();
    if (err > 0) {
      std::cerr << "Slang wrapper is not initialized properly." << std::endl;
    }

    this->FPGAHub_tree = new graph;
    this->builder = new GraphBuilder(this->sourceManager, this->FPGAHub_tree);
  }

  void load_to_FPGAHub_format() { // 1. Get the root of the elaborated design
    const auto &root = this->compilation->getRoot();

    // 2. Tell the root to accept your GraphBuilder visitor
    root.visit(*(this->builder));
  }

private:
  // loads the current working directory into slang to be traversed
  int parse_working_directory();

  // used to store the syntax trees
  slang::SourceManager sourceManager;
  std::vector<std::shared_ptr<slang::syntax::SyntaxTree>> syntaxTrees;
  std::unique_ptr<slang::ast::Compilation> compilation;

  graph *FPGAHub_tree;

  // tool to build the FPGAHub representation of the tree
  class GraphBuilder : public slang::ast::ASTVisitor<GraphBuilder> {
  public:
    GraphBuilder(const slang::SourceManager &sm, graph *graph_pt)
        : sourceManager(sm), FPGAHub_tree(graph_pt) {};
    void handle(const slang::ast::InstanceSymbol &node);

  private:
    const slang::SourceManager &sourceManager;

    std::stack<graph::module *> parent_modules;
    graph *FPGAHub_tree;
  };

  GraphBuilder *builder;
};

#endif
