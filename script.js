// Aba caixa
document.getElementById('caixa').addEventListener('click', function() {
    document.getElementById('conteudo').innerHTML = `
        <h1>Caixa - Ponto de Venda</h1>
        <label for="codigoProduto">Código do Produto:</label>
        <input type="text" id="codigoProduto" required>
        <div id="produtoInfo"></div>
        <h3>Carrinho de Compras</h3>
        <ul id="carrinho"></ul>
        <h4>Total: R$ <span id="total">0.00</span></h4>
        <button id="finalizarVenda">Finalizar Venda</button>
        <h3>Histórico de Vendas</h3>
        <ul id="historicoVendas"></ul>
    `;

    let db;
    const request = indexedDB.open("produtosDB", 3);  // Usando o mesmo banco 'produtosDB' e versão 3

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Verificar se a store 'produtos' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("produtos")) {
            const objectStore = db.createObjectStore("produtos", { keyPath: "codigo" });
            objectStore.createIndex("nome", "nome", { unique: false });
            objectStore.createIndex("preco", "preco", { unique: false });
            objectStore.createIndex("quantidade", "quantidade", { unique: false });
        }

        // Verificar se a store 'vendas' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("vendas")) {
            const vendasStore = db.createObjectStore("vendas", { keyPath: "id", autoIncrement: true });
            vendasStore.createIndex("data", "data", { unique: false });
            vendasStore.createIndex("total", "total", { unique: false });
            vendasStore.createIndex("produtos", "produtos", { unique: false });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;

        // Função que adiciona o produto ao carrinho
        function adicionarAoCarrinho(produto) {
            const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
            carrinho.push(produto);
            localStorage.setItem("carrinho", JSON.stringify(carrinho));

            // Atualiza a lista do carrinho e o total
            atualizarCarrinho();
        }

        // Função para atualizar a lista do carrinho e o total
        function atualizarCarrinho() {
            const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
            const carrinhoList = document.getElementById("carrinho");
            const totalSpan = document.getElementById("total");

            carrinhoList.innerHTML = ''; // Limpa a lista do carrinho
            let total = 0;

            carrinho.forEach(function(produto, index) {
                const listItem = document.createElement("li");
                listItem.textContent = `${produto.nome} - R$ ${produto.preco.toFixed(2)}`;
                
                // Criando o botão de remover
                const removeButton = document.createElement("button");
                removeButton.textContent = "Remover";
                removeButton.addEventListener("click", function() {
                    removerDoCarrinho(index);
                });

                // Adiciona o botão de remover ao item da lista
                listItem.appendChild(removeButton);
                carrinhoList.appendChild(listItem);
                total += produto.preco;
            });

            totalSpan.textContent = total.toFixed(2);
        }

        // Função para remover um item do carrinho
        function removerDoCarrinho(index) {
            const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

            // Remove o item com base no índice
            carrinho.splice(index, 1);

            // Atualiza o carrinho no localStorage
            localStorage.setItem("carrinho", JSON.stringify(carrinho));

            // Atualiza a lista do carrinho e o total
            atualizarCarrinho();
        }

        // Função para exibir o histórico de vendas
        function exibirHistoricoVendas() {
            const historicoVendasList = document.getElementById("historicoVendas");
            const transaction = db.transaction(["vendas"], "readonly");
            const vendasStore = transaction.objectStore("vendas");
            const requestGetAll = vendasStore.getAll();

            requestGetAll.onsuccess = function() {
                const vendas = requestGetAll.result;
                historicoVendasList.innerHTML = '';

                if (vendas.length > 0) {
                    vendas.forEach(function(venda) {
                        const listItem = document.createElement("li");
                        listItem.innerHTML = ` 
                            <strong>Data:</strong> ${new Date(venda.data).toLocaleString()} <br>
                            <strong>Total:</strong> R$ ${venda.total.toFixed(2)} <br>
                            <strong>Produtos:</strong> <ul>${venda.produtos.map(produto => `<li>${produto.nome} - R$ ${produto.preco.toFixed(2)}</li>`).join('')}</ul>
                        `;
                        historicoVendasList.appendChild(listItem);
                    });
                } else {
                    historicoVendasList.innerHTML = "<li>Nenhuma venda registrada.</li>";
                }
            };

            requestGetAll.onerror = function() {
                alert("Erro ao carregar o histórico de vendas.");
            };
        }

        // Finalizar a venda e descontar a quantidade do produto no estoque
        document.getElementById("finalizarVenda").addEventListener("click", function() {
            const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
            if (carrinho.length > 0) {
                const totalVenda = carrinho.reduce((total, produto) => total + produto.preco, 0);
                const produtosVendidos = carrinho.map(produto => ({ codigo: produto.codigo, nome: produto.nome, preco: produto.preco }));

                // Criar objeto de venda
                const venda = {
                    data: new Date().toISOString(),
                    total: totalVenda,
                    produtos: produtosVendidos
                };

                // Adicionar venda ao banco de dados
                const transaction = db.transaction(["vendas"], "readwrite");
                const vendasStore = transaction.objectStore("vendas");
                vendasStore.add(venda);

                transaction.oncomplete = function() {
                    alert(`Venda finalizada! Total: R$ ${totalVenda.toFixed(2)}`);
                    exibirHistoricoVendas(); // Atualizar o histórico de vendas
                };

                transaction.onerror = function() {
                    alert("Erro ao registrar a venda.");
                };

                // Atualizar o estoque e limpar o carrinho
                carrinho.forEach(function(produto) {
                    const transaction = db.transaction(["produtos"], "readwrite");
                    const objectStore = transaction.objectStore("produtos");
                    const requestGet = objectStore.get(produto.codigo);

                    requestGet.onsuccess = function() {
                        const produtoEstoque = requestGet.result;

                        if (produtoEstoque && produtoEstoque.quantidade > 0) {
                            produtoEstoque.quantidade -= 1;
                            const requestPut = objectStore.put(produtoEstoque);
                            requestPut.onsuccess = function() {
                                console.log(`Produto ${produto.nome} descontado do estoque. Quantidade restante: ${produtoEstoque.quantidade}`);
                            };
                            requestPut.onerror = function() {
                                alert("Erro ao descontar o produto do estoque.");
                            };
                        } else {
                            alert(`Produto ${produto.nome} fora de estoque!`);
                        }
                    };

                    requestGet.onerror = function() {
                        alert("Erro ao buscar o produto no estoque.");
                    };
                });

                localStorage.removeItem("carrinho");
                atualizarCarrinho();
            } else {
                alert("O carrinho está vazio.");
            }
        });

        // Adicionar produto ao carrinho automaticamente
        document.getElementById("codigoProduto").addEventListener("input", function() {
            const codigo = document.getElementById("codigoProduto").value;

            if (codigo.trim() !== "") {
                const transaction = db.transaction(["produtos"], "readonly");
                const objectStore = transaction.objectStore("produtos");
                const requestGet = objectStore.get(codigo);

                requestGet.onsuccess = function() {
                    const produto = requestGet.result;

                    if (produto) {
                        document.getElementById("produtoInfo").innerHTML = `
                            <p><strong>Nome:</strong> ${produto.nome}</p>
                            <p><strong>Código:</strong> ${produto.codigo}</p>
                            <p><strong>Preço:</strong> R$ ${produto.preco.toFixed(2)}</p>
                        `;
                        adicionarAoCarrinho(produto);
                        document.getElementById("codigoProduto").value = "";
                    } else {
                        document.getElementById("produtoInfo").innerHTML = `<p>Produto não encontrado!</p>`;
                    }
                };

                requestGet.onerror = function() {
                    alert("Erro ao buscar o produto.");
                };
            }
        });

        // Carregar o histórico de vendas ao carregar a página
        exibirHistoricoVendas();
    };

    request.onerror = function(event) {
        alert("Erro ao abrir o banco de dados.");
    };
});





// Quando o link "Mercadoria" for clicado
document.getElementById('mercadoria').addEventListener('click', function() {
    document.getElementById('conteudo').innerHTML = `
        <h1>Adicionar Quantidade ao Estoque</h1>
        <form id="formMercadoria">
            <label for="codigoMercadoria">Código do Produto:</label>
            <input type="text" id="codigoMercadoria" required><br><br>

            <label for="quantidade">Quantidade:</label>
            <input type="number" id="quantidade" required><br><br>

            <button type="submit">Adicionar ao Estoque</button>
        </form>
        <div id="produtoInfoMercadoria"></div>
    `;

    let db;
    const request = indexedDB.open("produtosDB", 3);  // Atualizando a versão para 3

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Criação da objectStore de produtos, se não existir
        if (!db.objectStoreNames.contains("produtos")) {
            const objectStore = db.createObjectStore("produtos", { keyPath: "codigo" });
            objectStore.createIndex("nome", "nome", { unique: false });
            objectStore.createIndex("preco", "preco", { unique: false });
            objectStore.createIndex("quantidade", "quantidade", { unique: false });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;

        // Adicionar quantidade ao estoque quando o formulário for enviado
        document.getElementById("formMercadoria").addEventListener("submit", function(event) {
            event.preventDefault();

            const codigo = document.getElementById("codigoMercadoria").value;
            const quantidade = parseInt(document.getElementById("quantidade").value);

            // Verifica se o produto já existe no banco de dados
            const transaction = db.transaction(["produtos"], "readwrite");
            const objectStore = transaction.objectStore("produtos");
            const requestGet = objectStore.get(codigo);

            requestGet.onsuccess = function() {
                const produto = requestGet.result;

                if (produto) {
                    // Produto existe, então adiciona a quantidade ao estoque
                    produto.quantidade = produto.quantidade ? produto.quantidade + quantidade : quantidade;

                    // Atualiza o produto no banco de dados
                    const requestPut = objectStore.put(produto);

                    requestPut.onsuccess = function() {
                        alert(`Quantidade do produto ${produto.nome} atualizada para ${produto.quantidade}`);
                        document.getElementById("formMercadoria").reset();
                        document.getElementById("produtoInfoMercadoria").innerHTML = `
                            <p><strong>Produto:</strong> ${produto.nome}</p>
                            <p><strong>Código:</strong> ${produto.codigo}</p>
                            <p><strong>Quantidade Atualizada:</strong> ${produto.quantidade}</p>
                        `;
                    };

                    requestPut.onerror = function() {
                        alert("Erro ao atualizar a quantidade.");
                    };
                } else {
                    // Produto não encontrado
                    document.getElementById("produtoInfoMercadoria").innerHTML = `<p>Produto não encontrado!</p>`;
                }
            };

            requestGet.onerror = function() {
                alert("Erro ao buscar o produto.");
            };
        });
    };

    request.onerror = function(event) {
        alert("Erro ao abrir o banco de dados.");
    };
});



// Quando o link "Estoque" for clicado
document.getElementById('estoque').addEventListener('click', function() {
    // Criando o formulário de cadastro de produto
    document.getElementById('conteudo').innerHTML = `
        <h1>Cadastro de Produto</h1>
        <form id="formProduto">
            <label for="nome">Nome do Produto:</label>
            <input type="text" id="nome" name="nome" required><br><br>
            
            <label for="codigo">Código do Produto:</label>
            <input type="text" id="codigo" name="codigo" required><br><br>
            
            <label for="preco">Preço:</label>
            <input type="number" id="preco" name="preco" required><br><br>
            
            <button type="submit">Salvar</button>
        </form>
    `;

    // Criação do banco de dados IndexedDB (versão 3)
    let db;
    const request = indexedDB.open("produtosDB", 3);  // Alterar para versão 3

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Verificar se a store 'produtos' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("produtos")) {
            const objectStore = db.createObjectStore("produtos", { keyPath: "codigo" });
            objectStore.createIndex("nome", "nome", { unique: false });
            objectStore.createIndex("preco", "preco", { unique: false });
            objectStore.createIndex("quantidade", "quantidade", { unique: false });
        }

        // Verificar se a store 'vendas' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("vendas")) {
            const vendasStore = db.createObjectStore("vendas", { keyPath: "id", autoIncrement: true });
            vendasStore.createIndex("data", "data", { unique: false });
            vendasStore.createIndex("total", "total", { unique: false });
            vendasStore.createIndex("produtos", "produtos", { unique: false });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;

        // Adicionar produto ao banco de dados quando o formulário for enviado
        document.getElementById("formProduto").addEventListener("submit", function(event) {
            event.preventDefault();

            const nome = document.getElementById("nome").value;
            const codigo = document.getElementById("codigo").value;
            const preco = parseFloat(document.getElementById("preco").value);

            const novoProduto = { nome: nome, codigo: codigo, preco: preco, quantidade: 0 }; // Quantidade inicial é 0

            // Criar uma transação para adicionar o produto
            const transaction = db.transaction(["produtos"], "readwrite");
            const objectStore = transaction.objectStore("produtos");
            const requestAdd = objectStore.add(novoProduto);

            requestAdd.onsuccess = function() {
                alert("Produto cadastrado com sucesso!");
                document.getElementById("formProduto").reset();
            };

            requestAdd.onerror = function() {
                alert("Erro ao cadastrar produto.");
            };
        });
    };

    request.onerror = function(event) {
        alert("Erro ao abrir o banco de dados.");
    };
});


// Quando o link "Consultar Estoque" for clicado
document.getElementById('consultar-estoque').addEventListener('click', function() {
    // Alterar o conteúdo da aba
    document.getElementById('conteudo').innerHTML = `
        <h1>Consultar Estoque</h1>
        <table id="tabelaEstoque">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Preço</th>
                    <th>Quantidade</th>
                </tr>
            </thead>
            <tbody>
                <!-- Os produtos serão inseridos aqui -->
            </tbody>
        </table>
    `;

    let db;
    const request = indexedDB.open("produtosDB", 3);  // Alterar para versão 3

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Verificar se a store 'produtos' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("produtos")) {
            const objectStore = db.createObjectStore("produtos", { keyPath: "codigo" });
            objectStore.createIndex("nome", "nome", { unique: false });
            objectStore.createIndex("preco", "preco", { unique: false });
            objectStore.createIndex("quantidade", "quantidade", { unique: false });
        }

        // Verificar se a store 'vendas' já existe e criar, se necessário
        if (!db.objectStoreNames.contains("vendas")) {
            const vendasStore = db.createObjectStore("vendas", { keyPath: "id", autoIncrement: true });
            vendasStore.createIndex("data", "data", { unique: false });
            vendasStore.createIndex("total", "total", { unique: false });
            vendasStore.createIndex("produtos", "produtos", { unique: false });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;

        // Criar uma transação para ler os produtos do banco de dados
        const transaction = db.transaction(["produtos"], "readonly");
        const objectStore = transaction.objectStore("produtos");
        const requestGetAll = objectStore.getAll(); // Pega todos os produtos

        requestGetAll.onsuccess = function() {
            const produtos = requestGetAll.result;
            const tabelaCorpo = document.querySelector("#tabelaEstoque tbody");

            // Limpar o corpo da tabela antes de inserir novos dados
            tabelaCorpo.innerHTML = '';

            produtos.forEach(function(produto) {
                // Criar uma nova linha para cada produto
                const row = document.createElement("tr");

                // Adicionar células com os dados do produto
                const cellCodigo = document.createElement("td");
                cellCodigo.textContent = produto.codigo;
                row.appendChild(cellCodigo);

                const cellNome = document.createElement("td");
                cellNome.textContent = produto.nome;
                row.appendChild(cellNome);

                const cellPreco = document.createElement("td");
                cellPreco.textContent = `R$ ${produto.preco.toFixed(2)}`;
                row.appendChild(cellPreco);

                const cellQuantidade = document.createElement("td");
                cellQuantidade.textContent = produto.quantidade;
                row.appendChild(cellQuantidade);

                // Adicionar a linha na tabela
                tabelaCorpo.appendChild(row);
            });
        };

        requestGetAll.onerror = function() {
            alert("Erro ao buscar os produtos.");
        };
    };

    request.onerror = function(event) {
        alert("Erro ao abrir o banco de dados.");
    };
});

/*Quando o link faturamento for clicado */
document.getElementById('faturamento').addEventListener('click', function() {
    document.getElementById('conteudo').innerHTML = `
        <h1>Faturamento - Histórico de Vendas</h1>
        <h3>Histórico de Vendas</h3>
        <ul id="historicoVendas"></ul>
    `;

    let db;
    const request = indexedDB.open("produtosDB", 3);  // Usando o banco de dados 'produtosDB' e versão 3

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Criar object store para vendas, se não existir
        if (!db.objectStoreNames.contains("vendas")) {
            const vendasStore = db.createObjectStore("vendas", { keyPath: "id", autoIncrement: true });
            vendasStore.createIndex("data", "data", { unique: false });
            vendasStore.createIndex("total", "total", { unique: false });
            vendasStore.createIndex("produtos", "produtos", { unique: false });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;

        // Função para exibir o histórico de vendas
        function exibirHistoricoVendas() {
            const historicoVendasList = document.getElementById("historicoVendas");
            const transaction = db.transaction(["vendas"], "readonly");
            const vendasStore = transaction.objectStore("vendas");
            const requestGetAll = vendasStore.getAll();

            requestGetAll.onsuccess = function() {
                const vendas = requestGetAll.result;
                historicoVendasList.innerHTML = '';

                if (vendas.length > 0) {
                    vendas.forEach(function(venda) {
                        const listItem = document.createElement("li");
                        listItem.innerHTML = `
                            <strong>Data:</strong> ${new Date(venda.data).toLocaleString()} <br>
                            <strong>Total:</strong> R$ ${venda.total.toFixed(2)} <br>
                            <strong>Produtos:</strong> <ul>${venda.produtos.map(produto => `<li>${produto.nome} - R$ ${produto.preco.toFixed(2)}</li>`).join('')}</ul>
                        `;
                        historicoVendasList.appendChild(listItem);
                    });
                } else {
                    historicoVendasList.innerHTML = "<li>Nenhuma venda registrada.</li>";
                }
            };

            requestGetAll.onerror = function() {
                alert("Erro ao carregar o histórico de vendas.");
            };
        }

        // Carregar o histórico de vendas ao acessar a aba "Faturamento"
        exibirHistoricoVendas();
    };

    request.onerror = function(event) {
        alert("Erro ao abrir o banco de dados.");
    };
});




