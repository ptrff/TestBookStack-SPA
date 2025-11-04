const { marked } = require('marked');
const fetch = require('node-fetch').default;

// 1. Получение данных из переменных окружения
const {
    BOOKSTACK_API_ID, 
    BOOKSTACK_API_SECRET, 
    BOOKSTACK_URL,
    BOOKSTACK_BOOK_ID,
    ISSUE_TITLE, 
    ISSUE_BODY, 
    ISSUE_NUMBER, 
    ISSUE_STATE,
    ISSUE_ACTION
} = process.env;

// Настройки API BookStack
const API_URL = `${BOOKSTACK_URL}/api/pages/${ISSUE_NUMBER}`;
const AUTH_HEADER = `Token ${BOOKSTACK_API_ID}:${BOOKSTACK_API_SECRET}`;

// 2. Конвертация Markdown в HTML
// Добавляем заголовок Issue в тело статьи BookStack
let htmlContent = `<h1>${ISSUE_TITLE}</h1>\n\n`;
htmlContent += marked.parse(ISSUE_BODY);

// Добавляем статус Issue в конец статьи
if (ISSUE_STATE === 'closed') {
    htmlContent += '<hr><h2>[СТАТЬЯ ЗАКРЫТА]</h2><p>Данная проблема была решена и закрыта в GitHub.</p>';
} else {
    htmlContent += '<hr><h2>[СТАТЬЯ АКТУАЛЬНА]</h2>';
}

// 3. Выбор действия API (POST для создания, PUT для обновления/закрытия)
let httpMethod;
let bookstackEndpoint;
const payload = {
    name: ISSUE_TITLE,
    html: htmlContent,
    // ВАЖНО: Укажите реальные ID Книги и Главы!
    // Эти ID должны существовать в вашем BookStack.
    book_id: BOOKSTACK_BOOK_ID,  
    chapter_id: 1 
};

if (ISSUE_ACTION === 'opened') {
    // Попытка создать статью (POST)
    httpMethod = 'POST';
    bookstackEndpoint = `${BOOKSTACK_URL}/api/pages`;
    // Добавляем slug на основе номера Issue для легкой идентификации
    payload.slug = `kcs-issue-${ISSUE_NUMBER}`; 
    console.log(`Action: OPENED. Attempting POST to create page with slug: ${payload.slug}`);
    
} else if (ISSUE_ACTION === 'edited' || ISSUE_ACTION === 'closed') {
    // Обновление существующей статьи (PUT)
    // endpoint использует ID статьи (который мы приравняли к ISSUE_NUMBER)
    httpMethod = 'PUT';
    bookstackEndpoint = `${BOOKSTACK_URL}/api/pages/${ISSUE_NUMBER}`;
    console.log(`Action: ${ISSUE_ACTION.toUpperCase()}. Attempting PUT to update page ID: ${ISSUE_NUMBER}`);
    
} else {
    console.log(`Action ${ISSUE_ACTION} is not implemented.`);
    return;
}

// 4. Отправка запроса к API BookStack
(async () => {
    try {
        const response = await fetch(bookstackEndpoint, {
            method: httpMethod,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AUTH_HEADER,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`API Error (${response.status} ${response.statusText}):`, data);
            
            // Если мы пытались обновить статью, которой нет (например, issues.edited), 
            // то нужно попытаться создать ее.
            if (response.status === 404 && (ISSUE_ACTION === 'edited' || ISSUE_ACTION === 'closed')) {
                console.log("Page not found, attempting to CREATE page instead...");
                
                // Сброс на создание
                payload.slug = `kcs-issue-${ISSUE_NUMBER}`;
                const createResponse = await fetch(`${BOOKSTACK_URL}/api/pages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': AUTH_HEADER,
                    },
                    body: JSON.stringify(payload),
                });
                
                if (createResponse.ok) {
                    console.log(`Successfully created page (ID: ${data.id}) after failed update.`);
                } else {
                    const createError = await createResponse.json();
                    console.error("Failed to create page:", createError);
                    process.exit(1);
                }
            } else {
                process.exit(1); // Завершаем с ошибкой
            }

        } else {
            console.log(`Successfully executed ${httpMethod} request. BookStack Page ID: ${data.id}`);
        }

    } catch (error) {
        console.error('Network or Script Error:', error);
        process.exit(1);
    }
})();
