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

void slang_wrapper::ASTTraverse::handle(
    const slang::ast::InstanceSymbol &node) {
  std::cout << std::string(indent_level * 2, ' ') << "|- [Instance] "
            << node.name << " (Module: " << node.getDefinition().name << ")\n";

  // Increase depth before visiting children
  indent_level++;

  this->visitDefault(node);

  // Decrease depth after returning from children
  indent_level--;
}
