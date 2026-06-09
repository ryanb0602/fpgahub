#include "../include/slang_wrapper.h"

int slang_wrapper::compile_current_dir() {
  // The SourceManager handles file loading and keeps track of line/column
  slang::SourceManager sourceManager;
  slang::ast::Compilation compilation;

  // We need to keep the syntax trees alive for the lifetime of the compilation
  std::vector<std::shared_ptr<slang::syntax::SyntaxTree>> syntaxTrees;

  // Get the directory where the executable was launched
  fs::path current_dir = fs::current_path();
  std::cout << "Scanning directory: " << current_dir << "\n";

  // 1. Iterate through the current directory
  for (const auto &entry : fs::directory_iterator(current_dir)) {
    if (entry.is_regular_file()) {
      std::string ext = entry.path().extension().string();

      // Look for Verilog/SystemVerilog files
      if (ext == ".v" || ext == ".sv" || ext == ".svh") {
        std::string file_path = entry.path().string();
        std::cout << "Found and parsing: " << entry.path().filename() << "\n";

        // 2. Read and parse the file from disk
        auto tree_result =
            slang::syntax::SyntaxTree::fromFile(file_path, sourceManager);

        // Check if the file parsed successfully
        if (tree_result.has_value()) {
          // Extract the actual shared_ptr from the expected wrapper
          auto tree = tree_result.value();
          syntaxTrees.push_back(tree);
          compilation.addSyntaxTree(tree);
        } else {
          std::cerr << "Failed to read or parse file: " << file_path << "\n";
        }
      }
    }
  }

  // If no files were found, exit early
  if (syntaxTrees.empty()) {
    std::cout
        << "No Verilog (.v, .sv, .svh) files found in the current directory.\n";
    return 0;
  }

  // 3. Force elaboration and build the AST
  std::cout << "\nElaborating design...\n";
  const auto &root = compilation.getRoot();

  // 4. Output top-level instances found across all parsed files
  std::cout << "\nTop level instances identified:\n";
  for (const auto *instance : root.topInstances) {
    std::cout << " - " << instance->name << "\n";
  }

  // 5. Check for global diagnostics (errors/warnings)
  auto diagnostics = compilation.getAllDiagnostics();
  if (!diagnostics.empty()) {
    std::cerr << "\nCompilation finished with " << diagnostics.size()
              << " errors/warnings.\n";
    return 1;
  }

  std::cout << "\nCompilation successful with 0 errors.\n";
  return 0;
}
