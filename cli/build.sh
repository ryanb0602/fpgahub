set -e

cd slang

cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=./install -DSLANG_USE_MIMALLOC=OFF

cmake --build build -j 8
cmake --install build

cd ..


g++ main.cpp ./src/*.cpp -o fpgahub -std=c++23 -I./include -I./slang/install/include -L./slang/install/lib -lsvlang -lfmt -ltomlplusplus -pthread
sudo mv ./fpgahub /usr/local/bin/fpgahub
sudo chmod +x /usr/local/bin/fpgahub
