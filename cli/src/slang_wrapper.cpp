#include "../include/slang_wrapper.h"

namespace fs = std::filesystem;

int slang_wrapper::parse_working_directory() {

  slang::ast::CompilationOptions options;
  options.flags |= slang::ast::CompilationFlags::IgnoreUnknownModules;

  this->compilation = std::make_unique<slang::ast::Compilation>(options);

  fs::path current_dir = fs::current_path();
  // iterate through the files in the working directory, parsing
  // verilog/systemverilog files
  for (const auto &entry : fs::recursive_directory_iterator(current_dir)) {
    if (entry.is_regular_file()) {
      std::string ext = entry.path().extension().string();

      if (ext == ".v" || ext == ".sv" || ext == ".svh") {
        std::string file_path = entry.path().string();

        // actually parse the syntax tree
        auto tree_result =
            slang::syntax::SyntaxTree::fromFile(file_path, this->sourceManager);

        // save our valid trees and add them to the current run
        if (tree_result.has_value()) {
          auto tree = tree_result.value();

          // if a file didn't parse well, prevent it from causing a cascading
          // error
          if (!tree->diagnostics().empty()) {
            std::cerr << "Skipping syntactically broken file: "
                      << entry.path().filename().string() << std::endl;
            continue;
          }

          this->syntaxTrees.push_back(tree);
          this->compilation->addSyntaxTree(tree);
        } else {
          std::cerr << "Parsed an empty tree: " << file_path << std::endl;
        }
      }
    }
  }

  if (this->syntaxTrees.empty()) {
    std::cout << "No verilog (.v, .sv, .svh) files have been found."
              << std::endl;
    return 1;
  }

  auto diagnostics = this->compilation->getAllDiagnostics();
  if (!diagnostics.empty()) {

    slang::DiagnosticEngine engine(this->sourceManager);

    engine.setIgnoreAllWarnings(true);

    auto client = std::make_shared<slang::TextDiagnosticClient>();
    engine.addClient(client);

    for (const auto &diag : diagnostics) {
      engine.issue(diag);
    }

    std::cerr << client->getString() << std::endl;

    std::cerr << "Compilation finished with " << diagnostics.size()
              << " errors/warnings." << std::endl;
    return 0;
  }

  std::cout << "Compilation successful with no errors.";
  return 0;
}

void slang_wrapper::GraphBuilder::handle(
    const slang::ast::InstanceSymbol &node) {
  graph::module *new_module = new graph::module;
  new_module->id = generate_uuid_v4();

  new_module->name = std::string(node.name);

  // pull the file the current node is from, save it
  auto location = node.getDefinition().location;
  new_module->file = std::string(this->sourceManager.getFileName(location));

  slang_wrapper::CanonicalHashBuilder hash_builder;
  node.body.visit(hash_builder);

  std::string raw_string = hash_builder.get_canonical_string();

  SHA256 hasher;
  hasher.update(raw_string);
  new_module->hash = hasher.final();

  // create back edge for this node
  if (!this->parent_modules.empty()) {
    graph::edge *new_edge = new graph::edge;
    new_edge->from = this->parent_modules.top();
    new_edge->to = new_module;

    new_edge->parent_port_hash = "PPH_FAKE";
    new_edge->child_port_hash = "CPH_FAKE";

    this->FPGAHub_tree->edges.push_back(new_edge);
  }

  // here is where you would calculate the canonical structure hash for the
  // module

  this->parent_modules.push(new_module);
  this->FPGAHub_tree->modules.push_back(new_module);

  // continue traversing
  this->visitDefault(node);

  // pop the parent
  this->parent_modules.pop();
}

void slang_wrapper::CanonicalHashBuilder::handle(
    const slang::ast::ContinuousAssignSymbol &node) {
  if (!this->is_sub_visitor) {
    this->components.push_back("ASSIGN:" +
                               capture_subtree(node.getAssignment()));
    return;
  }
  this->visitDefault(node);
}
void slang_wrapper::CanonicalHashBuilder::handle(
    const slang::ast::VariableSymbol &node) {
  if (!this->is_sub_visitor) {
    this->components.push_back("VAR:" + std::string(node.name));
    return;
  }
  this->visitDefault(node);
}

std::string slang_wrapper::CanonicalHashBuilder::get_canonical_string() {
  if (this->is_sub_visitor)
    return "";

  std::sort(this->components.begin(), this->components.end());
  std::string final_aggregate = "";
  for (const auto &comp : this->components) {
    final_aggregate += comp + "\n";
  }
  return final_aggregate;
}
std::string slang_wrapper::CanonicalHashBuilder::get_raw_string() {
  return canonical_string;
}

std::string
slang_wrapper::CanonicalHashBuilder::capture_subtree(const auto &node) {
  slang_wrapper::CanonicalHashBuilder sub_visitor;
  sub_visitor.is_sub_visitor = true;
  node.visit(sub_visitor);
  return sub_visitor.get_raw_string();
}
