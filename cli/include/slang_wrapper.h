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
#include "slang/ast/symbols/MemberSymbols.h"
#include "slang/ast/symbols/VariableSymbols.h"
#include "slang/diagnostics/DiagnosticEngine.h"
#include "slang/diagnostics/TextDiagnosticClient.h"
#include "slang/syntax/SyntaxTree.h"
#include "slang/text/SourceManager.h"

#include "../include/graph.h"
#include "../include/sha256.h"
#include "../include/utils.h"

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

  void load_to_FPGAHub_format() {
    const auto &root = this->compilation->getRoot();

    root.visit(*(this->builder));

    for (const graph::module *module : this->FPGAHub_tree->modules) {
      std::cout << "Name: " << module->name << " ID: " << module->id
                << " File: " << module->file << " Hash: " << module->hash
                << std::endl;
    }

    for (const graph::edge *edge : this->FPGAHub_tree->edges) {
      std::cout << "From: " << edge->from->name << " To: " << edge->to->name
                << std::endl;
    }
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

  // visitor that visits all non-module structural elements of a tree and
  // creates a canonical hash
  class CanonicalHashBuilder
      : public slang::ast::ASTVisitor<CanonicalHashBuilder,
                                      slang::ast::VisitFlags::AllGood> {
  public:
    bool is_sub_visitor = false;
    std::string canonical_string = "";

    // we do not want to visit or include modules, this is to create a
    // structural hash for just the module of interest. this will ensure modules
    // (instances in slang) are skipped
    void handle(const slang::ast::InstanceSymbol &node) { return; }

    // exploration functions to build the string

    void handle(const slang::ast::ContinuousAssignSymbol &node);
    void handle(const slang::ast::VariableSymbol &node);

    template <typename T> void handle(const T &node) {
      if constexpr (std::is_base_of_v<slang::ast::Expression, T>) {
        this->canonical_string +=
            "EXPR:" + std::string(slang::ast::toString(node.kind)) + ";";
      } else if constexpr (std::is_base_of_v<slang::ast::Statement, T>) {
        this->canonical_string +=
            "STMT:" + std::string(slang::ast::toString(node.kind)) + ";";
      }

      this->visitDefault(node);
    }

    void handle(const slang::ast::NamedValueExpression &node) {
      this->canonical_string +=
          "EXPR:NamedValue:" + std::string(node.symbol.name) + ";";
      this->visitDefault(node);
    }

    void handle(const slang::ast::IntegerLiteral &node) {
      this->canonical_string += "EXPR:Int:" + node.getValue().toString() + ";";
      this->visitDefault(node);
    }

    void handle(const slang::ast::StringLiteral &node) {
      this->canonical_string +=
          "EXPR:String:" + std::string(node.getValue()) + ";";
      this->visitDefault(node);
    }

    std::string get_canonical_string();
    std::string get_raw_string();

  private:
    std::vector<std::string> components;
    std::string capture_subtree(const auto &node);
  };
};

#endif
